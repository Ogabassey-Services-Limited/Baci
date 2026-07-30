import { randomBytes } from 'node:crypto';
import { link, open, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { beginBootstrap } from './install-bootstrap.mjs';

const MAX_PLAN_BYTES = 1024 * 1024;

function validatePlan(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_PLAN_BYTES)
    throw new TypeError('invalid bootstrap plan');
  let input;
  try {
    input = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new TypeError('invalid bootstrap plan');
  }
  if (!bytes.equals(Buffer.from(`${JSON.stringify(input)}\n`)))
    throw new TypeError('invalid bootstrap plan');
  const capture = beginBootstrap(input);
  if (input.transactionId !== `bootstrap-${capture.sourceSha.slice(0, 12)}`)
    throw new TypeError('invalid bootstrap plan');
}

async function syncDirectory(path) {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function publishBootstrapPlan(root, bytes, dependencies = {}) {
  validatePlan(bytes);
  const token = (dependencies.randomBytes ?? randomBytes)(16).toString('hex');
  if (!/^[0-9a-f]{32}$/.test(token))
    throw new TypeError('invalid bootstrap plan token');
  const staging = join(root, `.bootstrap-plan-stage.${token}`);
  const plan = join(root, `.plan.${token}`);
  const handle = await (dependencies.openFile ?? open)(staging, 'wx', 0o600);
  try {
    await (dependencies.writeTemporary ?? ((file) => file.writeFile(bytes)))(
      handle
    );
    dependencies.onEvent?.('write');
    await handle.chmod(0o600);
    await handle.sync();
    dependencies.onEvent?.('file-sync');
  } finally {
    await handle.close();
  }
  await (dependencies.linkFile ?? link)(staging, plan);
  dependencies.onEvent?.('link');
  await (dependencies.removeFile ?? unlink)(staging);
  dependencies.onEvent?.('unlink');
  await (dependencies.syncDirectory ?? syncDirectory)(root);
  dependencies.onEvent?.('dir-sync');
  return plan;
}

async function readStandardInput() {
  const chunks = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > MAX_PLAN_BYTES) throw new TypeError('invalid bootstrap plan');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

if (import.meta.filename === process.argv[1]) {
  const [root] = process.argv.slice(2);
  readStandardInput()
    .then((bytes) => publishBootstrapPlan(root, bytes))
    .then((plan) => process.stdout.write(`${plan}\n`))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
