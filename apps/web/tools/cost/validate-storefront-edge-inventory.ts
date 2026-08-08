import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createStorefrontEdgeInventory } from './create-storefront-edge-inventory';
import { canonicalizeStorefrontEdgeInventoryValue } from './storefront-edge-canonical-json';
import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';

type ValidationOptions = Readonly<{
  expectedOriginMainSha: string;
  inputPath: string;
  repoRoot: string;
}>;

type InventoryReadCandidate = Readonly<{
  originMainSha: string;
  pilotCandidateHostnames: readonly string[];
}> &
  Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isInventoryReadCandidate(
  value: unknown
): value is InventoryReadCandidate {
  if (!isRecord(value)) return false;
  const candidate = value;
  return (
    typeof candidate.originMainSha === 'string' &&
    Array.isArray(candidate.pilotCandidateHostnames) &&
    candidate.pilotCandidateHostnames.every(
      (hostname: unknown) => typeof hostname === 'string'
    )
  );
}

async function readInventory(path: string): Promise<InventoryReadCandidate> {
  const handle = await open(
    resolve(path),
    constants.O_RDONLY | constants.O_NOFOLLOW
  );
  try {
    const stat = await handle.stat();
    if (!stat.isFile())
      throw new Error('inventory input must be a regular file');
    const value: unknown = JSON.parse(await handle.readFile('utf8'));
    if (!isInventoryReadCandidate(value))
      throw new Error('inventory input has an invalid shape');
    return value;
  } finally {
    await handle.close();
  }
}

/** Rejects any Task 1A artifact that does not match the checked-out source tree. */
export async function validateStorefrontEdgeInventory(
  options: ValidationOptions
) {
  const artifact = await readInventory(options.inputPath);
  const expectedOriginMainSha = options.expectedOriginMainSha
    .trim()
    .toLowerCase();
  if (artifact.originMainSha !== expectedOriginMainSha)
    throw new Error('inventory origin authority does not match origin/main');
  let regenerated: StorefrontEdgeInventory;
  try {
    regenerated = await createStorefrontEdgeInventory({
      originMainSha: expectedOriginMainSha,
      pilotCandidateHostnames: artifact.pilotCandidateHostnames,
      repoRoot: options.repoRoot,
    });
  } catch (error) {
    throw new Error('inventory regeneration failed', { cause: error });
  }
  if (
    canonicalizeStorefrontEdgeInventoryValue(artifact) !==
    canonicalizeStorefrontEdgeInventoryValue(regenerated)
  )
    throw new Error(
      'inventory artifact does not match the canonical source tree'
    );
  return {
    inventorySha256: regenerated.inventorySha256,
    rowCount: regenerated.rows.length,
    storefrontEntrypointCount: regenerated.rows.filter(
      ({ sourceKind }) => sourceKind === 'storefront_entrypoint'
    ).length,
  };
}

function parseArguments(args: readonly string[]) {
  const allowedOptions = new Set(['--input', '--repo-root', '--source-sha']);
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (!option || !allowedOptions.has(option) || !value || values.has(option))
      throw new Error('inventory validation options are invalid');
    values.set(option, value);
  }
  const repoRoot = values.get('--repo-root');
  const inputPath = values.get('--input');
  const expectedOriginMainSha = values.get('--source-sha');
  if (!repoRoot || !inputPath || !expectedOriginMainSha)
    throw new Error(
      'inventory validation requires --repo-root, --input, and --source-sha'
    );
  return { expectedOriginMainSha, inputPath, repoRoot };
}

async function runCli(args: readonly string[]) {
  const result = await validateStorefrontEdgeInventory(parseArguments(args));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runCli(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
