import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const source = (value) => value.repeat(40);
const digest = (value) => value.repeat(64);
const intent = {
  schemaVersion: 1,
  baselineKind: 'complete',
  baselineSourceSha: source('a'),
  baselineStateSha256: digest('1'),
  sourceSha: source('b'),
  captureSha256: digest('2'),
  installedProjectionSha256: digest('3'),
  pathSetSha256: digest('4'),
  policyFileSha256: digest('5'),
  authorityChain: [
    {
      journalTipSha256: digest('6'),
      sealReceiptSha256: digest('7'),
      sourceSha: source('a'),
      stateSha256: digest('8'),
    },
    {
      journalTipSha256: digest('9'),
      sealReceiptSha256: digest('a'),
      sourceSha: source('b'),
      stateSha256: digest('b'),
    },
  ],
  transitionPaths: ['/srv/baci-cwv/sealed/bootstrap.sha256'],
};
const receipt = { ...intent, receiptSha256: digest('c') };

async function temporary(context, prefix) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  context.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

export default { digest, intent, receipt, temporary };
