import { lstat, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, isAbsolute, join, resolve } from 'node:path';
import ts from 'typescript';
import { cloudflareEvidencePrepare } from './cloudflare-evidence-prepare';
import {
  type EvidenceRunInput,
  loadEvidenceRunForCleanup,
} from './cloudflare-evidence-run-journal';
import {
  evidenceRunnerModuleEnvironmentNames,
  readEvidenceRunnerModuleDescriptor,
  verifyReviewedEvidenceFile,
  verifyReviewedEvidenceRunnerModule,
} from './cloudflare-evidence-runner-modules';
import { buildClosedEvidenceProcessEnvironment } from './qualify-cloudflare-evidence-sources';

export type EvidenceChildCommand = 'prepare' | 'mutate' | 'cleanup' | 'measure';
export type EvidenceProcessSpawner = Readonly<{
  spawn(
    executable: string,
    argv: readonly string[],
    options: Readonly<{ cwd: string; env: Record<string, string> }>
  ): Promise<void>;
}>;
type Credential = Readonly<{
  name: 'CLOUDFLARE_WRITE_TOKEN' | 'CLOUDFLARE_READ_TOKEN';
  value: string;
}>;

const argumentsFor = (
  command: EvidenceChildCommand,
  runId: string,
  prepareInput?: EvidenceRunInput
) => {
  if (command === 'prepare') {
    if (!prepareInput) throw new Error('prepare input is required');
    return cloudflareEvidencePrepare.argumentsFor(prepareInput);
  }
  if (command === 'cleanup') return ['--cleanup-run', runId];
  if (command === 'mutate') return ['--run', runId, '--apply'];
  return ['--run', runId];
};
const scriptFor = (command: EvidenceChildCommand) =>
  command === 'prepare'
    ? 'qualify-cloudflare-evidence-sources.ts'
    : command === 'measure'
      ? 'measure-cloudflare-evidence-sources.ts'
      : 'mutate-cloudflare-evidence-sources.ts';
const pinnedTsx = (workspaceRoot: string) =>
  resolve(workspaceRoot, 'node_modules/.bin/tsx');
const absoluteToolPath = (
  workspaceRoot: string,
  command: EvidenceChildCommand
) => resolve(workspaceRoot, 'apps/web/tools/cost', scriptFor(command));

const MODULE_EXTENSIONS = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
] as const;

function staticImportSpecifiers(source: string, filePath: string) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const specifiers: string[] = [];
  const visit = (node: ts.Node) => {
    const moduleSpecifier =
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
        ? node.moduleSpecifier.text
        : ts.isImportEqualsDeclaration(node) &&
            !node.isTypeOnly &&
            ts.isExternalModuleReference(node.moduleReference) &&
            ts.isStringLiteralLike(node.moduleReference.expression)
          ? node.moduleReference.expression.text
          : ts.isCallExpression(node) &&
              (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
                (ts.isIdentifier(node.expression) &&
                  node.expression.text === 'require')) &&
              node.arguments.length === 1 &&
              ts.isStringLiteralLike(node.arguments[0])
            ? node.arguments[0].text
            : undefined;
    if (moduleSpecifier) specifiers.push(moduleSpecifier);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
}

async function resolveLocalImport(from: string, specifier: string) {
  const requested = isAbsolute(specifier)
    ? specifier
    : resolve(dirname(from), specifier);
  const candidates = extname(requested)
    ? [requested]
    : [
        ...MODULE_EXTENSIONS.map((extension) => `${requested}${extension}`),
        ...MODULE_EXTENSIONS.slice(1).map(
          (extension) => `${requested}/index${extension}`
        ),
      ];
  for (const candidate of candidates) {
    try {
      const stat = await lstat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      // Continue through the extension and index candidates.
    }
  }
  throw new Error('credentialed evidence command import is not a local file');
}

async function verifyCredentialedCommandImportClosure(
  workspaceRoot: string,
  toolingMergeSha: string,
  entrypoint: string
) {
  const visited = new Set<string>([entrypoint]);
  const pending = [entrypoint];
  while (pending.length) {
    const current = pending.pop() as string;
    const source = await readFile(current, 'utf8');
    for (const specifier of staticImportSpecifiers(source, current)) {
      if (!specifier.startsWith('.') && !isAbsolute(specifier)) continue;
      const imported = await resolveLocalImport(current, specifier);
      const verified = await verifyReviewedEvidenceFile(
        workspaceRoot,
        toolingMergeSha,
        imported
      );
      if (!visited.has(verified.path)) {
        visited.add(verified.path);
        pending.push(verified.path);
      }
    }
  }
}

const prepareEnvironment = (
  inherited: Readonly<Record<string, string | undefined>>
) => {
  if (
    !inherited.EVIDENCE_APPROVAL_ARTIFACT ||
    !inherited.EVIDENCE_POLICY_ARTIFACT ||
    !isAbsolute(inherited.EVIDENCE_APPROVAL_ARTIFACT) ||
    !isAbsolute(inherited.EVIDENCE_POLICY_ARTIFACT)
  )
    throw new Error(
      'prepare authority artifact paths must be absolute and allowlisted'
    );
  readEvidenceRunnerModuleDescriptor(inherited, 'mutation');
  readEvidenceRunnerModuleDescriptor(inherited, 'measurement');
  const names = [
    'PATH',
    'TMPDIR',
    'EVIDENCE_APPROVAL_ARTIFACT',
    'EVIDENCE_POLICY_ARTIFACT',
    'EVIDENCE_PROTECTED_MERGE_IDENTITY_ARTIFACT',
    evidenceRunnerModuleEnvironmentNames('mutation').path,
    evidenceRunnerModuleEnvironmentNames('mutation').sha256,
    evidenceRunnerModuleEnvironmentNames('measurement').path,
    evidenceRunnerModuleEnvironmentNames('measurement').sha256,
  ] as const;
  return Object.fromEntries(
    names
      .filter((name) => inherited[name])
      .map((name) => [name, inherited[name] as string])
  );
};

/** Spawns exactly one purpose-bound command with a closed environment and one credential. */
export async function spawnIsolatedCloudflareEvidenceProcess(
  spawner: EvidenceProcessSpawner,
  command: EvidenceChildCommand,
  runId: string,
  inherited: Readonly<Record<string, string | undefined>>,
  credential: Credential | undefined,
  workspaceRoot: string,
  stateDir: string,
  prepareInput?: EvidenceRunInput
) {
  if (!isAbsolute(workspaceRoot) || !isAbsolute(stateDir))
    throw new Error(
      'workspace root and evidence state directory must be absolute'
    );
  const needsCredential = command !== 'prepare';
  if (needsCredential !== Boolean(credential))
    throw new Error('command credential responsibility is invalid');
  if (
    (command === 'mutate' || command === 'cleanup') &&
    credential?.name !== 'CLOUDFLARE_WRITE_TOKEN'
  )
    throw new Error('write command requires only the write credential');
  if (command === 'measure' && credential?.name !== 'CLOUDFLARE_READ_TOKEN')
    throw new Error('measurement requires only the read credential');
  const privateHome = await mkdtemp(join(tmpdir(), 'baci-evidence-home-'));
  try {
    const env = credential
      ? buildClosedEvidenceProcessEnvironment(
          credential.name,
          credential.value,
          inherited
        )
      : prepareEnvironment(inherited);
    env.HOME = privateHome;
    env.XDG_CONFIG_HOME = join(privateHome, 'config');
    env.XDG_DATA_HOME = join(privateHome, 'data');
    env.EVIDENCE_RUN_STATE_DIR = stateDir;
    env.EVIDENCE_WORKSPACE_ROOT = workspaceRoot;
    const journal =
      command === 'prepare'
        ? undefined
        : await loadEvidenceRunForCleanup(stateDir, runId);
    let commandPath = absoluteToolPath(workspaceRoot, command);
    if (journal) {
      commandPath = (
        await verifyReviewedEvidenceFile(
          workspaceRoot,
          journal.toolingMergeSha,
          commandPath
        )
      ).path;
      await verifyCredentialedCommandImportClosure(
        workspaceRoot,
        journal.toolingMergeSha,
        commandPath
      );
    }
    const runnerNames =
      command === 'measure'
        ? evidenceRunnerModuleEnvironmentNames('measurement')
        : command === 'prepare'
          ? undefined
          : evidenceRunnerModuleEnvironmentNames('mutation');
    if (runnerNames) {
      if (!journal) throw new Error('credentialed command journal is missing');
      const descriptor =
        command === 'measure'
          ? {
              path: journal.measurementRunnerModulePath,
              sha256: journal.measurementRunnerModuleSha256,
            }
          : {
              path: journal.mutationRunnerModulePath,
              sha256: journal.mutationRunnerModuleSha256,
            };
      const modulePath = descriptor.path;
      const moduleSha256 = descriptor.sha256;
      if (!modulePath || !moduleSha256)
        throw new Error(
          'journal is missing the reviewed runner module descriptor'
        );
      const verified = await verifyReviewedEvidenceRunnerModule(
        workspaceRoot,
        journal.toolingMergeSha,
        { path: modulePath, sha256: moduleSha256 }
      );
      env[runnerNames.path] = verified.path;
      env[runnerNames.sha256] = verified.sha256;
    }
    return await spawner.spawn(
      pinnedTsx(workspaceRoot),
      [commandPath, ...argumentsFor(command, runId, prepareInput)],
      {
        cwd: workspaceRoot,
        env,
      }
    );
  } finally {
    await rm(privateHome, { recursive: true, force: true });
  }
}
