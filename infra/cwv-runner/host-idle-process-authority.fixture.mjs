import { createHash } from 'node:crypto';

const digest = (character) => character.repeat(64);
const canonical = (value) =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
          .join(',')}}`
      : JSON.stringify(value);
const roles = [
  ['bash', '/usr/bin/bash', '1'],
  ['runtimeNode', '/opt/node/bin/node', 'c'],
  ['listener', '/opt/runner/bin/Runner.Listener', 'd'],
  ['worker', '/opt/runner/bin/Runner.Worker', 'e'],
  ['pluginHost', '/opt/runner/bin/Runner.PluginHost', 'f'],
  ['actionNode', '/opt/runner/externals/node24/bin/node', '7'],
  ['git', '/usr/bin/git', '8'],
  ['gitRemoteHttps', '/usr/lib/git-core/git-remote-https', '9'],
];

export function processAuthority(imageId) {
  const entries = roles.map(([role, path, hash]) => ({
    maxInstancesByPhase: ['runtimeNode', 'listener'].includes(role)
      ? [0, 1, 1, 0]
      : [0, 0, 0, 0],
    mode: '0555',
    owner: '0:0',
    path,
    realpath: path,
    role,
    sha256: digest(hash),
  }));
  const processMap = {
    entries,
    phases: ['held', 'listener-idle', 'assigned', 'cleanup'],
    receiptBinding: 'image-process-map-v1',
    schemaVersion: 1,
    sealed: [
      ...entries.map(({ mode, owner, path, realpath, sha256 }) => ({
        mode,
        owner,
        path,
        realpath,
        sha256,
      })),
      {
        mode: '0555',
        owner: '0:0',
        path: '/opt/google/chrome/chrome',
        realpath: '/opt/google/chrome/chrome',
        sha256: digest('6'),
      },
    ].sort((left, right) => left.path.localeCompare(right.path)),
  };
  return {
    hostBinaries: {
      containerdBuild: 'build',
      containerdSha256: digest('b'),
      containerdVersion: '1.0.0',
      dockerBuild: 'build',
      dockerSha256: digest('a'),
      dockerVersion: '1.0.0',
    },
    identityContractSha256: digest('4'),
    imageId,
    imageReceiptSha256: digest('5'),
    processMap,
    processMapSha256: createHash('sha256')
      .update(canonical(processMap))
      .digest('hex'),
    schemaVersion: 1,
  };
}
