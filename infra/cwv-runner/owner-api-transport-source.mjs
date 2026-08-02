import { exact, fail } from './owner-api-transport-primitives.mjs';

export const TRANSPORT_ENTRY = 'infra/cwv-runner/owner-api-transport.mjs';
export const TRANSPORT_SOURCE_FILES = Object.freeze([
  'infra/cwv-runner/owner-api-transport-cli-state.mjs',
  'infra/cwv-runner/owner-api-transport-evidence.mjs',
  'infra/cwv-runner/owner-api-transport-failure.mjs',
  'infra/cwv-runner/owner-api-transport-hold.mjs',
  'infra/cwv-runner/owner-api-transport-http.mjs',
  'infra/cwv-runner/owner-api-transport-operation-evidence.mjs',
  'infra/cwv-runner/owner-api-transport-pagination.mjs',
  'infra/cwv-runner/owner-api-transport-primitives.mjs',
  'infra/cwv-runner/owner-api-transport-requests.mjs',
  'infra/cwv-runner/owner-api-transport-runtime.mjs',
  'infra/cwv-runner/owner-api-transport-security.mjs',
  'infra/cwv-runner/owner-api-transport-source.mjs',
  'infra/cwv-runner/owner-api-transport-zip.mjs',
  TRANSPORT_ENTRY,
  'infra/cwv-runner/task9-owner-documents.mjs',
]);

function validRow(row) {
  return (
    exact(row, ['path', 'sha256']) &&
    typeof row.path === 'string' &&
    /^infra\/cwv-runner\/[a-z0-9._-]+$/.test(row.path) &&
    /^[a-f0-9]{64}$/.test(row.sha256)
  );
}

export function sourceFilesFrom(source) {
  const rows = source?.sourceFiles;
  if (
    !Array.isArray(rows) ||
    rows.length < TRANSPORT_SOURCE_FILES.length ||
    rows.some((row) => !validRow(row)) ||
    rows.map((row) => row.path).join('\n') !==
      [...rows.map((row) => row.path)].sort().join('\n') ||
    new Set(rows.map((row) => row.path)).size !== rows.length
  )
    fail('invalid authorization');
  const byPath = new Map(rows.map((row) => [row.path, row.sha256]));
  if (TRANSPORT_SOURCE_FILES.some((path) => !byPath.has(path)))
    fail('invalid authorization');
  return byPath;
}

export function sourceFileDigest(source, path) {
  const digest = sourceFilesFrom(source).get(path);
  if (!digest) fail('invalid authorization');
  return digest;
}
