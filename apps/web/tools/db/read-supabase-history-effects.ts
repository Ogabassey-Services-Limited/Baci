import { createHash } from 'node:crypto';
import { buildSupabaseHistoryEffectDigests } from './build-supabase-history-effect-digests';
import { canonicalReplayEffectJson } from './canonical-replay-effect-json';
import { compareSupabaseHistoryEffectDigests } from './compare-supabase-history-effect-digests';
import { productionHistoryEffectsSchema } from './schemas/production-history-effects-schema';
import { supabaseHistoryEffectSnapshotSchema } from './schemas/supabase-history-effect-snapshot-schema';
import { summarizeSupabaseHistoryEffects } from './summarize-supabase-history-effects';
import type { SupabaseHistoryEffectComparisonMode } from './supabase-history-replay-types';
import { validateSupabaseHistoryEffectComponents } from './validate-supabase-history-effect-components';

const SERVER_VERSION_QUERY =
  'SELECT current_setting(\'server_version_num\')::int AS "serverVersionNum", current_setting(\'transaction_read_only\') AS "transactionReadOnly"';
const EXPECTED_SERVER_VERSION = 170006;

type ExecuteSelect = (sql: string) => Promise<unknown[]>;

function scrubSql(sql: string): string {
  let result = '';
  let index = 0;
  while (index < sql.length) {
    const pair = sql.slice(index, index + 2);
    if (pair === '--') {
      const end = sql.indexOf('\n', index + 2);
      index = end === -1 ? sql.length : end;
      result += ' ';
      continue;
    }
    if (pair === '/*') {
      const end = sql.indexOf('*/', index + 2);
      if (end === -1) throw new Error('effect query is not SELECT-only');
      index = end + 2;
      result += ' ';
      continue;
    }
    const quote = sql[index];
    if (quote === "'" || quote === '"') {
      const doubled = quote + quote;
      index += 1;
      while (index < sql.length) {
        if (sql.slice(index, index + 2) === doubled) {
          index += 2;
          continue;
        }
        if (sql[index] === quote) {
          index += 1;
          break;
        }
        index += 1;
      }
      result += ' ';
      continue;
    }
    if (quote === '$') {
      const tag = sql.slice(index).match(/^\$[A-Za-z0-9_]*\$/)?.[0];
      if (tag) {
        const end = sql.indexOf(tag, index + tag.length);
        if (end === -1) throw new Error('effect query is not SELECT-only');
        index = end + tag.length;
        result += ' ';
        continue;
      }
    }
    result += quote;
    index += 1;
  }
  return result;
}

function assertSelectOnly(sql: string): void {
  if (sql.includes('\0')) throw new Error('effect query is not SELECT-only');
  const scrubbed = scrubSql(sql).trim();
  const withoutTerminal = scrubbed.endsWith(';')
    ? scrubbed.slice(0, -1).trimEnd()
    : scrubbed;
  if (
    !/^(?:SELECT|WITH)\b/i.test(withoutTerminal) ||
    withoutTerminal.includes(';') ||
    /\b(?:INTO|INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|GRANT|REVOKE|CALL|DO|COPY|TRUNCATE|MERGE|VACUUM|ANALYZE|REFRESH|REINDEX|CLUSTER|LOCK)\b/i.test(
      withoutTerminal
    )
  ) {
    throw new Error('effect query is not SELECT-only');
  }
}

function parseProductionFixture(
  fixture: string | undefined,
  querySha256: string
) {
  if (fixture === undefined) return undefined;
  try {
    const parsed = productionHistoryEffectsSchema.parse(JSON.parse(fixture));
    if (parsed.source.querySha256 !== querySha256) throw new Error('mismatch');
    return parsed;
  } catch {
    throw new Error('production effect receipt mismatch');
  }
}

function assertSafeEffects(
  effects: ReturnType<typeof summarizeSupabaseHistoryEffects>
): void {
  const safe =
    effects.componentCount === 76 &&
    effects.domainEventRpcCount === 19 &&
    Object.entries(effects).every(([key, value]) => {
      if (key === 'componentCount') return value === 76;
      if (key === 'domainEventRpcCount') return value === 19;
      return value === true;
    });
  if (!safe) throw new Error('effect snapshot safety mismatch');
}

export async function readSupabaseHistoryEffects({
  comparisonMode = 'enforce',
  effectQuery,
  expectedEffectQuerySha256,
  executeSelect,
  productionFixture,
}: {
  comparisonMode?: SupabaseHistoryEffectComparisonMode;
  effectQuery: string;
  expectedEffectQuerySha256: string;
  executeSelect: ExecuteSelect;
  productionFixture?: string;
}) {
  const actualQuerySha256 = createHash('sha256')
    .update(effectQuery)
    .digest('hex');
  if (actualQuerySha256 !== expectedEffectQuerySha256) {
    throw new Error('Reviewed effect query drift');
  }
  assertSelectOnly(effectQuery);
  const production = parseProductionFixture(
    productionFixture,
    actualQuerySha256
  );
  if (comparisonMode === 'classify' && !production) {
    throw new Error('production effect receipt mismatch');
  }

  let preflight: unknown[];
  try {
    preflight = await executeSelect(SERVER_VERSION_QUERY);
  } catch {
    throw new Error('server version preflight failed');
  }
  if (
    preflight.length !== 1 ||
    (preflight[0] as { serverVersionNum?: unknown })?.serverVersionNum !==
      EXPECTED_SERVER_VERSION ||
    (preflight[0] as { transactionReadOnly?: unknown })?.transactionReadOnly !==
      'on'
  ) {
    throw new Error('server version preflight mismatch');
  }

  let rows: unknown[];
  try {
    rows = await executeSelect(effectQuery);
  } catch {
    throw new Error('effect snapshot query failed');
  }
  const rawSnapshot =
    rows.length === 1 ? (rows[0] as { snapshot?: unknown })?.snapshot : null;
  const parsed = supabaseHistoryEffectSnapshotSchema.safeParse(rawSnapshot);
  if (!parsed.success) {
    throw new Error('effect snapshot failed strict validation');
  }

  let components: ReturnType<typeof validateSupabaseHistoryEffectComponents>;
  try {
    components = validateSupabaseHistoryEffectComponents(
      parsed.data.components
    );
  } catch {
    throw new Error('effect snapshot scope mismatch');
  }
  const { digestVector, effectSha256 } =
    buildSupabaseHistoryEffectDigests(components);
  const effects = summarizeSupabaseHistoryEffects(components);
  assertSafeEffects(effects);

  const productionExtensionVersions = production?.diagnostics.extensionVersions;
  const diagnostics = {
    extensionVersions: parsed.data.diagnostics.extensionVersions,
    ...(productionExtensionVersions && {
      extensionVersionDrift:
        canonicalReplayEffectJson(parsed.data.diagnostics.extensionVersions) !==
        canonicalReplayEffectJson(productionExtensionVersions),
      productionExtensionVersions,
    }),
  };
  const comparison = production
    ? compareSupabaseHistoryEffectDigests({
        localDigestVector: digestVector,
        mode: comparisonMode,
        productionDigestVector: production.digestVector,
        productionEffectSha256: production.effectSha256,
      })
    : undefined;

  return {
    diagnostics,
    digestVector,
    effectSha256,
    effects,
    scopeVersion: parsed.data.scopeVersion,
    serverVersionNum: parsed.data.serverVersionNum,
    ...(comparison && { comparison }),
  };
}
