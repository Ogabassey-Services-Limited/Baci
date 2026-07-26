import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const cliSource = await readFile(
  new URL('./install-prepare-content-cleanup-cli.mjs', import.meta.url),
  'utf8'
);

async function runCli(cli, command, transactionId, campaign, log) {
  await execute(process.execPath, [cli, command, transactionId, campaign], {
    env: { ...process.env, CLI_TEST_LOG: log },
  });
}

test('dispatches capture, activate, and cleanup through the exact receipt contract', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-content-cleanup-cli-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const cli = join(root, 'install-prepare-content-cleanup-cli.mjs');
  const cleanup = join(root, 'install-prepare-content-cleanup.mjs');
  const campaign = join(root, 'campaign');
  const log = join(root, 'calls.jsonl');
  const transactionId = 'prepare-content-cli-test';
  const receipt = { generation: 'sealed' };
  await writeFile(cli, cliSource);
  await writeFile(
    cleanup,
    "import { appendFile } from 'node:fs/promises';\n" +
      "const record = (method, options) => appendFile(process.env.CLI_TEST_LOG, JSON.stringify({ method, options }) + '\\n');\n" +
      "export async function capturePrepareContentRoots(options) { await record('capture', options); return { generation: 'captured' }; }\n" +
      "export async function activatePrepareContentRoots(options) { await record('activate', options); }\n" +
      "export async function cleanupPrepareContentRoots(options) { await record('cleanup', options); }\n"
  );
  await import('node:fs/promises').then(({ mkdir }) => mkdir(campaign));
  await writeFile(
    join(campaign, 'prepare-content-roots.json'),
    JSON.stringify(receipt)
  );

  await runCli(cli, 'capture', transactionId, campaign, log);
  await runCli(cli, 'activate', transactionId, campaign, log);
  await runCli(cli, 'cleanup', transactionId, campaign, log);

  assert.deepEqual(
    (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse),
    [
      { method: 'capture', options: { transactionId, campaign } },
      { method: 'activate', options: { transactionId, campaign, receipt } },
      { method: 'cleanup', options: { transactionId, campaign, receipt } },
    ]
  );
});

test('rejects malformed cleanup commands before importing a receipt', async () => {
  await assert.rejects(
    execute(process.execPath, [
      fileURLToPath(
        new URL('./install-prepare-content-cleanup-cli.mjs', import.meta.url)
      ),
      'invalid',
    ]),
    /invalid prepare content command/
  );
});
