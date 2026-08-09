import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  writeExecutable,
  writeJob,
  writeStage,
} from './install-remediation-cron-transition.test-fixtures.mjs';

const transitionScript = join(
  dirname(fileURLToPath(import.meta.url)),
  'install-remediation-cron-transition.sh'
);
const globalLockSource = join(
  dirname(fileURLToPath(import.meta.url)),
  'remediation-global-lock.mjs'
);
const transactionSource = join(
  dirname(fileURLToPath(import.meta.url)),
  'remediation-cron-transition.py'
);

function waitFor(path) {
  const waiter = new Int32Array(new SharedArrayBuffer(4));
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (existsSync(path)) return;
    Atomics.wait(waiter, 0, 0, 10);
  }
  throw new Error(`timed out waiting for ${path}`);
}

export function runTransition(scenario) {
  const directory = mkdtempSync(join(tmpdir(), 'baci-cron-transition-'));
  const binDirectory = join(directory, 'bin');
  const crontabMarker = join(directory, 'installed-crontab');
  const lockMarker = join(directory, 'legacy-locks');
  const barrierMarker = join(directory, 'barrier-active');
  const remoteDirectory = join(directory, 'remote');
  const stageDirectory = join(directory, 'stage');
  const procRoot = join(directory, 'proc');
  const jobsDirectory = join(remoteDirectory, 'jobs');
  const directReady = join(directory, 'direct-ready');
  mkdirSync(binDirectory);
  mkdirSync(jobsDirectory, { recursive: true });
  mkdirSync(join(remoteDirectory, 'lib'), { recursive: true });
  mkdirSync(procRoot);
  writeStage(stageDirectory, globalLockSource, transactionSource);
  for (const name of [
    'vercel-error-remediator',
    'sentry-mobile-error-remediator',
    'remediation-codex-canary',
  ]) {
    writeJob(join(jobsDirectory, `${name}.mjs`), 'process.exitCode = 0;\n');
  }
  writeFileSync(
    join(remoteDirectory, 'lib', 'remediation-global-lock.mjs'),
    'export {};\n'
  );
  writeExecutable(
    join(binDirectory, 'ssh'),
    `#!/usr/bin/env bash
set -euo pipefail
shift
bash -c "$1"
`
  );
  writeExecutable(
    join(binDirectory, 'flock'),
    `#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "-x" ] && [ "$2" = "/tmp/baci-workers-deploy.lock" ]; then
  shift 2
  exec "$@"
fi
if [ "$1" = "-x" ]; then
  printf '%s\\n' "$2" >> "$LOCK_MARKER"
  if [ "$2" = "6" ]; then touch "$BARRIER_MARKER"; fi
fi
`
  );
  writeExecutable(
    join(binDirectory, 'crontab'),
    `#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "-l" ]; then
  if grep -q BARRIER_MARKER "$REMOTE_DIR/jobs/vercel-error-remediator.mjs" && { [ "$TEST_SCENARIO" = "launch-race" ] || [ "$TEST_SCENARIO" = "rollback" ]; }; then
    set +e
    node "$REMOTE_DIR/jobs/vercel-error-remediator.mjs"
    status="$?"
    set -e
    if [ "$status" -ne 75 ]; then
      echo "new direct launch escaped the transition barrier" >&2
      exit 92
    fi
  fi
  if [ -f "$CRONTAB_MARKER" ]; then
    cat "$CRONTAB_MARKER"
    exit 0
  fi
  case "$TEST_SCENARIO" in
    no-crontab)
      echo "no crontab for test-user" >&2
      exit 1
      ;;
    read-error)
      echo "permission denied" >&2
      exit 2
      ;;
    preserve-unrelated)
      echo "# watchdog mentions jobs/vercel-error-remediator.mjs"
      echo "* * * * * node jobs/watchdog.mjs jobs/vercel-error-remediator.mjs"
      echo "*/15 * * * * flock -n $REMOTE_DIR/locks/vercel-error-remediator.lock bash -lc 'cd $REMOTE_DIR && $NODE_BIN $REMOTE_DIR/jobs/vercel-error-remediator.mjs' >> $REMOTE_DIR/logs/vercel-error-remediator.log 2>&1"
      ;;
    *)
      echo "0 1 * * * /usr/local/bin/unrelated-worker"
      ;;
  esac
  exit 0
fi
if [ "$TEST_SCENARIO" = "interleaving" ] && [ "$(wc -l < "$LOCK_MARKER")" -lt 4 ]; then
  echo "transaction locks were not all held before the crontab rewrite" >&2
  exit 88
fi
if [ "$TEST_SCENARIO" = "rollback" ]; then
  exit 91
fi
if { [ "$TEST_SCENARIO" = "direct-exit" ] || [ "$TEST_SCENARIO" = "alternate-node-exit" ]; } && [ -d "$PROC_ENTRY" ]; then
  echo "legacy direct process was still active at crontab rewrite" >&2
  exit 89
fi
if [ "$TEST_SCENARIO" = "operator-change" ]; then
  echo "* * * * * /usr/local/bin/operator-change" > "$CRONTAB_MARKER"
else
  cp "$1" "$CRONTAB_MARKER"
fi
`
  );

  let directProcess;
  let directProcessPid;
  let procEntry = '';
  try {
    if (
      scenario === 'direct-exit' ||
      scenario === 'direct-timeout' ||
      scenario === 'alternate-node-exit' ||
      scenario === 'unrelated-process' ||
      scenario === 'watchdog-argument'
    ) {
      const job = join(
        jobsDirectory,
        scenario === 'unrelated-process'
          ? 'unrelated-worker.mjs'
          : 'vercel-error-remediator.mjs'
      );
      const exitTimer =
        scenario === 'direct-timeout'
          ? 'setTimeout(() => {}, 5000);'
          : 'setTimeout(() => rmSync(process.env.PROC_ENTRY, { force: true, recursive: true }), 1500);';
      writeJob(
        job,
        `import { rmSync, writeFileSync } from 'node:fs'; writeFileSync(process.env.DIRECT_READY, String(process.pid)); ${exitTimer}`
      );
      const command =
        scenario === 'alternate-node-exit'
          ? join(binDirectory, 'node')
          : process.execPath;
      writeExecutable(
        join(binDirectory, 'node'),
        `#!/usr/bin/env bash\nexec ${process.execPath} "$@"\n`
      );
      const args =
        scenario === 'watchdog-argument'
          ? [
              join(jobsDirectory, 'watchdog.mjs'),
              'jobs/vercel-error-remediator.mjs',
            ]
          : [
              scenario === 'alternate-node-exit'
                ? 'jobs/vercel-error-remediator.mjs'
                : job,
            ];
      if (scenario === 'watchdog-argument') {
        writeJob(
          join(jobsDirectory, 'watchdog.mjs'),
          "import { rmSync, writeFileSync } from 'node:fs'; writeFileSync(process.env.DIRECT_READY, String(process.pid)); setTimeout(() => rmSync(process.env.PROC_ENTRY, { force: true, recursive: true }), 1500);"
        );
      }
      const processDirectory = join(procRoot, '4242');
      procEntry = processDirectory;
      mkdirSync(processDirectory);
      writeFileSync(
        join(processDirectory, 'cmdline'),
        `node\0${scenario === 'watchdog-argument' ? 'jobs/watchdog.mjs\0jobs/vercel-error-remediator.mjs' : 'jobs/vercel-error-remediator.mjs'}\0`
      );
      symlinkSync(remoteDirectory, join(processDirectory, 'cwd'));
      symlinkSync(join(binDirectory, 'node'), join(processDirectory, 'exe'));
      if (scenario === 'watchdog-argument') {
        writeFileSync(directReady, '0');
      } else {
        directProcess = spawn(command, args, {
          cwd: scenario === 'alternate-node-exit' ? remoteDirectory : undefined,
          env: {
            ...process.env,
            DIRECT_READY: directReady,
            PROC_ENTRY: processDirectory,
          },
          stdio: 'ignore',
        });
        directProcess.unref();
        waitFor(directReady);
        directProcessPid = readFileSync(directReady, 'utf8').trim();
      }
    }
    const result = spawnSync(
      'bash',
      [
        '-c',
        '. "$1"; install_remediation_cron_transition',
        '--',
        transitionScript,
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          BARRIER_MARKER: barrierMarker,
          CODEX_CONTAINER_BIN: '/usr/local/bin/codex',
          CODEX_REMEDIATOR_IMAGE: 'baci/codex:test',
          CRONTAB_MARKER: crontabMarker,
          DIRECT_PROCESS_PID: directProcessPid ?? '',
          LOCK_MARKER: lockMarker,
          NODE_BIN:
            scenario === 'alternate-node-exit'
              ? '/opt/alternate-node/bin/node'
              : process.execPath,
          PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
          PROC_ENTRY: procEntry,
          REMOTE_DIR: remoteDirectory,
          STAGING_DIR: stageDirectory,
          BACI_REMEDIATION_LEGACY_DRAIN_TIMEOUT_SECONDS:
            scenario === 'direct-exit' || scenario === 'alternate-node-exit'
              ? '5'
              : '1',
          BACI_REMEDIATION_PROC_ROOT:
            scenario === 'proc-unavailable'
              ? join(directory, 'missing-proc')
              : procRoot,
          TEST_SCENARIO: scenario,
          VPS: 'test-vps',
        },
      }
    );
    return {
      crontab: existsSync(crontabMarker)
        ? readFileSync(crontabMarker, 'utf8')
        : '',
      locks: existsSync(lockMarker)
        ? readFileSync(lockMarker, 'utf8').trim().split('\n')
        : [],
      remoteEntry: readFileSync(
        join(jobsDirectory, 'vercel-error-remediator.mjs'),
        'utf8'
      ),
      result,
    };
  } finally {
    if (directProcessPid) {
      try {
        process.kill(Number(directProcessPid));
      } catch {
        // The drained child has already exited.
      }
    }
    directProcess?.kill();
    rmSync(directory, { force: true, recursive: true });
  }
}
