import { readFileSync } from 'node:fs';
import {
  requestSupervisorStop,
  watchPrepare,
} from './install-prepare-live-supervisor.mjs';

const parentPid = process.ppid;
let parentStart;

function currentStartTime(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const end = stat.lastIndexOf(')');
    const fields = stat
      .slice(end + 2)
      .trim()
      .split(' ');
    return end > 0 && /^[0-9]+$/.test(fields[19]) ? fields[19] : undefined;
  } catch {
    return undefined;
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const [transaction, capture, captureSha, policy, directory, start] = args;
  if (command === 'watch' && args.length === 6 && /^[0-9]+$/.test(start)) {
    parentStart = start;
    await watchPrepare(transaction, capture, captureSha, policy, directory);
  } else if (command === 'stop' && args.length === 1)
    await requestSupervisorStop(transaction);
  else
    throw new Error(
      'usage: live-supervisor watch <transaction> <capture> <capture-sha> <policy> <directory> <start> | stop <directory>'
    );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  try {
    if (
      parentStart &&
      parentPid > 1 &&
      process.ppid === parentPid &&
      currentStartTime(parentPid) === parentStart
    )
      process.kill(parentPid, 'SIGTERM');
  } catch (signalError) {
    process.stderr.write(
      `supervisor parent signal failed: ${signalError.message}\n`
    );
  }
  process.exitCode = 1;
});
