import {
  SUPABASE_REPLAY_PORT_KEYS,
  type SupabaseReplayPortKey,
  type SupabaseReplayPortMap,
} from './allocate-supabase-replay-ports';

export type ParsedSupabaseReplayConfig = {
  dbMajorVersion: 17;
  imageTransformationEnabled: boolean;
  poolerEnabled: boolean;
  ports: SupabaseReplayPortMap;
  projectId: string;
};

type Assignment = {
  key: string;
  lineIndex: number;
  qualifiedKey: string;
  section: string;
  value: string;
};

type ScannedConfig = {
  assignments: Map<string, Assignment>;
  lines: string[];
};

const GENERATED_PROJECT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,62}$/;
const OWNED_PROJECT_ID = /^[a-z0-9][a-z0-9_-]{2,62}$/;
const PORT_KEYS = new Set<string>(SUPABASE_REPLAY_PORT_KEYS);

function scanConfig(config: string): ScannedConfig {
  if (!config || config.includes('\r')) throw new Error();
  const lines = config.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const assignments = new Map<string, Assignment>();
  let section = '';
  for (const [lineIndex, lineWithLf] of lines.entries()) {
    const line = lineWithLf.endsWith('\n')
      ? lineWithLf.slice(0, -1)
      : lineWithLf;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const sectionMatch = trimmed.match(/^\[([A-Za-z0-9_.-]+)\](?:\s*#.*)?$/);
    if (sectionMatch) {
      section = sectionMatch[1] ?? '';
      continue;
    }
    if (trimmed.startsWith('[')) throw new Error();
    const assignmentMatch = line.match(
      /^\s*([A-Za-z0-9_]+)\s*=\s*([^#]*?)(?:\s*#.*)?$/
    );
    if (!assignmentMatch) continue;
    const key = assignmentMatch[1] ?? '';
    const value = (assignmentMatch[2] ?? '').trim();
    const qualifiedKey = section ? `${section}.${key}` : key;
    const relevant =
      key === 'enabled' ||
      key === 'major_version' ||
      key === 'project_id' ||
      key === 'port' ||
      key.endsWith('_port');
    if (!relevant) continue;
    if (assignments.has(qualifiedKey)) throw new Error();
    assignments.set(qualifiedKey, {
      key,
      lineIndex,
      qualifiedKey,
      section,
      value,
    });
  }
  return { assignments, lines };
}

function booleanValue(
  assignments: Map<string, Assignment>,
  key: string,
  fallback: boolean
): boolean {
  const assignment = assignments.get(key);
  if (!assignment) return fallback;
  if (assignment.value === 'true') return true;
  if (assignment.value === 'false') return false;
  throw new Error();
}

function integerValue(assignment: Assignment | undefined): number {
  if (!assignment || !/^\d+$/.test(assignment.value)) throw new Error();
  const value = Number.parseInt(assignment.value, 10);
  if (!Number.isSafeInteger(value)) throw new Error();
  return value;
}

function parseConfig(config: string): ParsedSupabaseReplayConfig {
  const { assignments } = scanConfig(config);
  const projectMatch = assignments
    .get('project_id')
    ?.value.match(/^"([A-Za-z0-9][A-Za-z0-9_-]{2,62})"$/);
  const projectId = projectMatch?.[1];
  if (!projectId || !GENERATED_PROJECT_ID.test(projectId)) throw new Error();

  const dbMajorVersion = integerValue(assignments.get('db.major_version'));
  if (dbMajorVersion !== 17) throw new Error();

  const ports = {} as SupabaseReplayPortMap;
  for (const key of SUPABASE_REPLAY_PORT_KEYS) {
    const section = key.slice(0, key.lastIndexOf('.'));
    if (!booleanValue(assignments, `${section}.enabled`, true)) {
      throw new Error();
    }
    const port = integerValue(assignments.get(key));
    if (port < 1024 || port > 65_535) throw new Error();
    ports[key] = port;
  }
  if (new Set(Object.values(ports)).size !== SUPABASE_REPLAY_PORT_KEYS.length) {
    throw new Error();
  }

  const poolerEnabled = booleanValue(assignments, 'db.pooler.enabled', true);
  const imageTransformationEnabled = booleanValue(
    assignments,
    'storage.image_transformation.enabled',
    false
  );
  for (const assignment of assignments.values()) {
    if (assignment.key !== 'port' && !assignment.key.endsWith('_port')) {
      continue;
    }
    integerValue(assignment);
    if (PORT_KEYS.has(assignment.qualifiedKey)) continue;
    const sectionEnabled = booleanValue(
      assignments,
      `${assignment.section}.enabled`,
      true
    );
    if (sectionEnabled) throw new Error();
  }
  if (poolerEnabled) throw new Error();

  return {
    dbMajorVersion: 17,
    imageTransformationEnabled,
    poolerEnabled,
    ports,
    projectId,
  };
}

export function parseSupabaseReplayConfig(
  config: string
): ParsedSupabaseReplayConfig {
  try {
    return parseConfig(config);
  } catch {
    throw new Error('Invalid Supabase replay config');
  }
}

export function rewriteSupabaseReplayConfig(
  config: string,
  options: { ports: SupabaseReplayPortMap; projectId: string }
): string {
  try {
    const original = parseConfig(config);
    if (!OWNED_PROJECT_ID.test(options.projectId)) throw new Error();
    const values = Object.values(options.ports);
    if (
      Object.keys(options.ports).length !== SUPABASE_REPLAY_PORT_KEYS.length ||
      values.some(
        (port) =>
          !Number.isInteger(port) ||
          port < 1024 ||
          port > 65_535 ||
          Object.values(original.ports).includes(port)
      ) ||
      new Set(values).size !== SUPABASE_REPLAY_PORT_KEYS.length
    ) {
      throw new Error();
    }

    const scanned = scanConfig(config);
    const replacements = new Map<string, string>([
      ['project_id', `"${options.projectId}"`],
      ...SUPABASE_REPLAY_PORT_KEYS.map(
        (key) => [key, String(options.ports[key])] as const
      ),
    ]);
    for (const [qualifiedKey, replacement] of replacements) {
      const assignment = scanned.assignments.get(qualifiedKey);
      if (!assignment) throw new Error();
      const line = scanned.lines[assignment.lineIndex];
      if (!line) throw new Error();
      const newline = line.endsWith('\n') ? '\n' : '';
      const body = newline ? line.slice(0, -1) : line;
      const pattern = new RegExp(
        `^(\\s*${assignment.key}\\s*=\\s*)([^#]*?)(\\s*(?:#.*)?)$`
      );
      const match = body.match(pattern);
      if (!match) throw new Error();
      scanned.lines[assignment.lineIndex] =
        `${match[1]}${replacement}${match[3]}${newline}`;
    }
    const rewritten = scanned.lines.join('');
    const parsed = parseConfig(rewritten);
    if (
      parsed.projectId !== options.projectId ||
      SUPABASE_REPLAY_PORT_KEYS.some(
        (key: SupabaseReplayPortKey) => parsed.ports[key] !== options.ports[key]
      )
    ) {
      throw new Error();
    }
    return rewritten;
  } catch {
    throw new Error('Invalid Supabase replay config rewrite');
  }
}
