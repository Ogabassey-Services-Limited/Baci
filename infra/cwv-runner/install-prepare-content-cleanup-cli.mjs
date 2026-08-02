import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  activatePrepareContentRoots,
  capturePrepareContentRoots,
  cleanupPrepareContentRoots,
} from './install-prepare-content-cleanup.mjs';

async function main() {
  const [command, transactionId, campaign] = process.argv.slice(2);
  if (
    !['capture', 'activate', 'cleanup'].includes(command) ||
    process.argv.length !== 5
  )
    throw new Error('invalid prepare content command');
  const options = { transactionId, campaign };
  if (command === 'capture') {
    process.stdout.write(
      `${JSON.stringify(await capturePrepareContentRoots(options))}\n`
    );
    return;
  }
  const receipt = JSON.parse(
    await readFile(join(campaign, 'prepare-content-roots.json'), 'utf8')
  );
  if (command === 'activate')
    await activatePrepareContentRoots({ ...options, receipt });
  else await cleanupPrepareContentRoots({ ...options, receipt });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
