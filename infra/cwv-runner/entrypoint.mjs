import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  cpSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson, canonicalSha256 } from './canonical-json.mjs';
import {
  awaitNormalRelease,
  parseRuntimeIdentityReceipt,
  runListenerOnce,
  runRegistrationLifecycle,
  validateCommandSettingsReceipt,
  validatePolicyBytes,
} from './entrypoint-runtime.mjs';
import {
  defaultNormalContainerIdentity,
  hostMonotonicMilliseconds,
} from './normal-release.mjs';
import { readSealedRunnerFile } from './sealed-runner.mjs';

export {
  awaitNormalRelease,
  registrationCommand,
  runListenerOnce,
  runRegistrationLifecycle,
  validateCommandSettingsReceipt,
  validatePolicyBytes,
} from './entrypoint-runtime.mjs';
export { validateSealedRunnerFileMetadata } from './sealed-runner.mjs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// biome-ignore format: closed list is intentionally compact for the audited line cap.
const runnerCopyDenied = new Set(['config.sh', 'env.sh', 'run.sh', 'run-helper.sh.template', 'safe_sleep.sh']);
const fail = (message) => {
  throw new TypeError(message);
};
function secureRead(path, expectedMode, expectedGid = 10001) {
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = fstatSync(descriptor);
    if (
      !info.isFile() ||
      info.uid !== 0 ||
      info.gid !== expectedGid ||
      (info.mode & 0o777) !== expectedMode
    )
      fail('secure file identity refused');
    return readFileSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}
// biome-ignore format: compact trusted-environment reader preserves the audited runtime cap.
function exactEnvironment(name) { const value = process.env[name]; if (!value) fail(`missing ${name}`); return value; }
function exactMonotonicSeconds(name) {
  const value = exactEnvironment(name);
  const parsed = Number(value);
  if (!/^(0|[1-9][0-9]*)$/.test(value) || !Number.isSafeInteger(parsed))
    fail(`invalid ${name}`);
  return parsed;
}
function registrationCli(validated) {
  const stagingRoot = '/registration-staging/actions-runner';
  const stagingInfo = lstatSync('/registration-staging');
  if (
    !stagingInfo.isDirectory() ||
    stagingInfo.uid !== 10001 ||
    stagingInfo.gid !== 10001 ||
    (stagingInfo.mode & 0o777) !== 0o700 ||
    !readFileSync('/proc/self/mountinfo', 'utf8').includes(
      ' /registration-staging '
    )
  )
    fail('registration staging mount refused');
  if (readdirSync('/registration-staging').length !== 0)
    fail('registration staging not empty');
  validateCommandSettingsReceipt(
    secureRead(
      '/opt/baci-cwv/command-settings-receipt.json',
      0o444,
      0
    ).toString('utf8'),
    validated.policy
  );
  const runtimeIdentity = parseRuntimeIdentityReceipt(
    secureRead('/opt/baci-cwv/image-process-map.json', 0o444, 0).toString(
      'utf8'
    ),
    (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
  );
  return runRegistrationLifecycle(
    {
      nodeArgvSha256: canonicalSha256(process.argv),
      nodeExecutableSha256: runtimeIdentity.nodeExecutableSha256,
      pid: process.pid,
      policy: validated.policy,
      policyCanonicalSha256: validated.policyCanonicalSha256,
      policyFileSha256: validated.policyFileSha256,
      registrationNonce: exactEnvironment('BACI_CWV_REGISTRATION_NONCE'),
      releaseBindings: {
        activeEgressRuleSha256: exactEnvironment(
          'BACI_CWV_ACTIVE_EGRESS_RULE_SHA256'
        ),
        campaignId: exactEnvironment('BACI_CWV_CAMPAIGN_ID'),
        captureSha256: exactEnvironment('BACI_CWV_CAPTURE_SHA256'),
        cgroupNamespace: exactEnvironment('BACI_CWV_CGROUP_NAMESPACE'),
        containerId: exactEnvironment('BACI_CWV_CONTAINER_ID'),
        imageDigest: exactEnvironment('BACI_CWV_IMAGE_DIGEST'),
        mountNamespace: exactEnvironment('BACI_CWV_MOUNT_NAMESPACE'),
        tokenAbsenceSha256: exactEnvironment('BACI_CWV_TOKEN_ABSENCE_SHA256'),
        tokenDeleteSha256: exactEnvironment('BACI_CWV_TOKEN_DELETE_SHA256'),
        tokenUnmountSha256: exactEnvironment('BACI_CWV_TOKEN_UNMOUNT_SHA256'),
        userNamespace: exactEnvironment('BACI_CWV_USER_NAMESPACE'),
        zeroCountersSha256: exactEnvironment('BACI_CWV_ZERO_COUNTERS_SHA256'),
      },
      stagingRoot,
    },
    {
      copyRunnerOnce: () => {
        mkdirSync(stagingRoot, { mode: 0o700 });
        cpSync('/opt/runner/.', stagingRoot, {
          // biome-ignore format: closed filter is intentionally compact for the audited line cap.
          filter: (source) => basename(source) !== '.env' && !runnerCopyDenied.has(basename(source)),
          recursive: true,
        });
        const digest = (path) =>
          createHash('sha256').update(readFileSync(path)).digest('hex');
        if (
          digest('/opt/runner/bin/Runner.Listener') !==
          digest(`${stagingRoot}/bin/Runner.Listener`)
        )
          fail('runner copy mismatch');
      },
      execve: process.execve,
      monotonicMilliseconds: hostMonotonicMilliseconds,
      postReleaseExecFailureCleanup: () => undefined,
      preExecFailureCleanup: () => undefined,
      readReleaseOnce: () =>
        secureRead(
          '/run/baci-cwv-registration-release/release.json',
          0o440
        ).toString('utf8'),
      readTokenOnce: () =>
        secureRead('/run/secrets/runner-registration-token', 0o440),
      waitForTokenAbsence: async () => {
        for (let attempt = 0; attempt < 50; attempt += 1) {
          try {
            lstatSync('/run/secrets/runner-registration-token');
          } catch (error) {
            if (error.code === 'ENOENT') return;
            throw error;
          }
          await delay(100);
        }
        fail('token absence timeout');
      },
      writeReadyOnce: (bytes) =>
        writeFileSync('/registration-staging/registration-ready.json', bytes, {
          flag: 'wx',
          mode: 0o400,
        }),
    }
  );
}
function normalCli(validated) {
  for (const path of [
    '/run/secrets/runner-registration-token',
    '/run/baci-cwv-registration-release',
  ]) {
    try {
      lstatSync(path);
      fail('registration state present in normal mode');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const stagingInfo = lstatSync('/registration-staging');
  if (
    !stagingInfo.isDirectory() ||
    stagingInfo.uid !== 10001 ||
    stagingInfo.gid !== 10001 ||
    (stagingInfo.mode & 0o777) !== 0o700 ||
    readdirSync('/registration-staging').length !== 0 ||
    readFileSync('/proc/self/mountinfo', 'utf8').includes(
      ' /registration-staging '
    )
  )
    fail('normal staging state refused');
  const runnerBytes = readSealedRunnerFile('/opt/runner/.runner');
  const identityBytes = readSealedRunnerFile(
    '/opt/runner/.baci-cwv-identity.json'
  );
  const runner = JSON.parse(runnerBytes);
  const identity = JSON.parse(identityBytes);
  const expectedIdentity = {
    labels: 'baci-cwv-measurement',
    name: validated.policy.runner.name,
    repository: `https://github.com/${validated.policy.repository.name}`,
  };
  if (
    `${canonicalJson(runner)}\n` !== runnerBytes ||
    runner.gitHubUrl !== expectedIdentity.repository ||
    runner.agentName !== expectedIdentity.name ||
    canonicalJson(identity) !== canonicalJson(expectedIdentity)
  )
    fail('sealed runner identity refused');
  const releaseDirectory = '/run/baci-cwv-listener-release';
  const releaseInfo = lstatSync(releaseDirectory);
  const releaseMount = readFileSync('/proc/self/mountinfo', 'utf8')
    .split('\n')
    .find((row) => row.includes(` ${releaseDirectory} `));
  if (
    !releaseInfo.isDirectory() ||
    releaseInfo.uid !== 0 ||
    releaseInfo.gid !== 10001 ||
    (releaseInfo.mode & 0o777) !== 0o750 ||
    !releaseMount?.split(' ')[5]?.split(',').includes('ro')
  )
    fail('normal release mount refused');
  const deadline = exactMonotonicSeconds(
    'BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS'
  );
  const notBefore = exactMonotonicSeconds(
    'BACI_CWV_LISTENER_RELEASE_NOT_BEFORE_MONOTONIC_SECONDS'
  );
  if (
    deadline < notBefore ||
    deadline - notBefore >
      validated.policy.repositoryAuthority.listenerHoldTimeoutSeconds
  )
    fail('normal release deadline refused');
  const releasePath = `${releaseDirectory}/release.json`;
  return awaitNormalRelease(
    {
      bindings: {
        campaignId: exactEnvironment('BACI_CWV_CAMPAIGN_ID'),
        captureSha256: exactEnvironment('BACI_CWV_CAPTURE_SHA256'),
        ...defaultNormalContainerIdentity(),
        policyFileSha256: validated.policyFileSha256,
      },
      deadline,
      holdTimeoutSeconds:
        validated.policy.repositoryAuthority.listenerHoldTimeoutSeconds,
      notBefore,
    },
    {
      delay: () => delay(100),
      monotonicSeconds: () => Math.trunc(hostMonotonicMilliseconds() / 1_000),
      readReleaseIfPresent: () => {
        try {
          return secureRead(releasePath, 0o440).toString('utf8');
        } catch (error) {
          if (error.code === 'ENOENT') return undefined;
          throw error;
        }
      },
      startListenerOnce: () =>
        runListenerOnce('/opt/runner/bin/Runner.Listener'),
    }
  );
}
function main() {
  const [modeFlag, mode, ...extra] = process.argv.slice(2);
  if (modeFlag !== '--mode' || extra.length !== 0) fail('mode refused');
  const validated = validatePolicyBytes(
    secureRead('/opt/baci-cwv/policy.json', 0o444, 0),
    secureRead('/run/baci-cwv-policy/policy.sha256', 0o440)
  );
  if (mode === 'registration') return registrationCli(validated);
  if (mode === 'normal') return normalCli(validated);
  fail('mode refused');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await main();
  } catch (error) {
    if (Number.isInteger(error?.exitStatus))
      process.exitCode = error.exitStatus;
    else throw error;
  }
}
