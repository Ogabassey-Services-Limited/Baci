import { randomBytes } from 'node:crypto';
import { link, lstat, open, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { beginBootstrap } from './install-bootstrap.mjs';

const MAX_PLAN_BYTES = 1024 * 1024;
const PLAN_STAGE = /^\.bootstrap-plan-stage\.([0-9a-f]{32})$/;

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

async function reconcileUnpublishedStages(root, dependencies) {
  const names = await (dependencies.listFiles ?? readdir)(root);
  let removed = false;
  for (const name of names) {
    const token = PLAN_STAGE.exec(name)?.[1];
    if (!token || names.includes(`.plan.${token}`)) continue;
    const stage = join(root, name);
    const details = await (dependencies.statFile ?? lstat)(stage);
    if (
      !details.isFile() ||
      details.isSymbolicLink() ||
      details.uid !== process.getuid() ||
      details.gid !== process.getgid() ||
      (details.mode & 0o777) !== 0o600 ||
      details.nlink !== 1 ||
      details.size > MAX_PLAN_BYTES
    )
      throw new TypeError('invalid unpublished bootstrap plan staging');
    await (dependencies.removeFile ?? unlink)(stage);
    removed = true;
  }
  if (removed) await (dependencies.syncDirectory ?? syncDirectory)(root);
}

export async function publishBootstrapPlan(root, bytes, dependencies = {}) {
  validatePlan(bytes);
  await reconcileUnpublishedStages(root, dependencies);
  const token = (dependencies.randomBytes ?? randomBytes)(16).toString('hex');
  if (!/^[0-9a-f]{32}$/.test(token))
    throw new TypeError('invalid bootstrap plan token');
  const staging = join(root, `.bootstrap-plan-stage.${token}`);
  const plan = join(root, `.plan.${token}`);
  let linked = false;
  const handle = await (dependencies.openFile ?? open)(staging, 'wx', 0o600);
  try {
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
  } catch (error) {
    await (dependencies.removeFile ?? unlink)(staging);
    await (dependencies.syncDirectory ?? syncDirectory)(root);
    throw error;
  }
  try {
    await (dependencies.linkFile ?? link)(staging, plan);
    linked = true;
    dependencies.onEvent?.('link');
    await (dependencies.removeFile ?? unlink)(staging);
    dependencies.onEvent?.('unlink');
    await (dependencies.syncDirectory ?? syncDirectory)(root);
    dependencies.onEvent?.('dir-sync');
    return plan;
  } catch (error) {
    if (!linked) {
      await (dependencies.removeFile ?? unlink)(staging);
      await (dependencies.syncDirectory ?? syncDirectory)(root);
    }
    throw error;
  }
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
