import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const appRoot = path.resolve(__dirname, '..');
const scriptsRoot = path.join(appRoot, 'scripts');
const avdName = 'Baci_Pixel_9_Pro_XL_API_36_Google';
type Harness = {
  cleanup: () => void;
  env: NodeJS.ProcessEnv;
  stateDir: string;
};
type EnvOverrides = Record<string, string | undefined>;
function writeExecutable(filePath: string, source: string) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, source);
  chmodSync(filePath, 0o755);
}

function createHarness(): Harness {
  const root = mkdtempSync(path.join(tmpdir(), 'baci-storefront-android-'));
  const sdkRoot = path.join(root, 'sdk');
  const stateDir = path.join(root, 'state');
  const avdHome = path.join(root, 'avd-home');
  mkdirSync(stateDir, { recursive: true });
  mkdirSync(path.join(avdHome, `${avdName}.avd`), { recursive: true });
  writeExecutable(
    path.join(sdkRoot, 'platform-tools/adb'),
    `#!/usr/bin/env bash
set -euo pipefail
STATE_DIR="\${BACI_FAKE_ANDROID_STATE_DIR:?}"
serial=""
if [[ "\${1:-}" == "-s" ]]; then
  serial="$2"
  shift 2
fi
cmd="\${1:-}"
if [[ "$#" -gt 0 ]]; then
  shift
fi
echo "\${serial:+-s $serial }\${cmd} $*" >> "$STATE_DIR/adb.log"
case "$cmd" in
  kill-server)
    exit 0 ;;
  start-server)
    if [[ "\${BACI_FAKE_ADB_START_STALL:-0}" == "1" ]]; then
      sleep 30
    fi
    exit 0 ;;
  devices)
    echo "List of devices attached"
    if [[ -f "$STATE_DIR/device-present" ]]; then
      printf 'emulator-%s\\tdevice\\n' "\${BACI_ANDROID_EMULATOR_PORT:-5554}"
    fi
    ;;
  emu)
    if [[ "\${1:-}" == "kill" && "\${BACI_FAKE_ADB_KEEP_DEVICE_AFTER_KILL:-0}" != "1" ]]; then
      rm -f "$STATE_DIR/device-present"
    fi
    ;;
  get-state)
    echo "device" ;;
  reverse)
    if [[ "\${1:-}" == "--list" ]]; then
      echo "emulator-5554 tcp:8082 tcp:8082"
    else
      echo "reverse $*" >> "$STATE_DIR/reverse-ran"
    fi
    ;;
  shell)
    subcmd="\${1:-}"
    if [[ "$#" -gt 0 ]]; then
      shift
    fi
    case "$subcmd" in
      getprop)
        if [[ "\${1:-}" == "sys.boot_completed" ]]; then
          printf '%s\\n' "\${BACI_FAKE_ADB_BOOT_COMPLETED:-1}"
        fi
        ;;
      echo)
        printf '%s\\n' "$*"
        ;;
      cat)
        if [[ "\${1:-}" == "/proc/loadavg" ]]; then
          echo "\${BACI_FAKE_ADB_LOADAVG:-0.01 0.01 0.01 1/100 123}"
        fi
        ;;
      pidof)
        echo "\${BACI_FAKE_ADB_PIDOF:-4242}"
        ;;
      am)
        echo "am $*" >> "$STATE_DIR/am-ran"
        ;;
      svc | settings | cmd)
        exit 0
        ;;
    esac
    ;;
esac
`
  );
  writeExecutable(
    path.join(sdkRoot, 'emulator/emulator'),
    `#!/usr/bin/env bash
set -euo pipefail
STATE_DIR="\${BACI_FAKE_ANDROID_STATE_DIR:?}"
if [[ "\${1:-}" == "-version" ]]; then
  echo "Android emulator version 36.3.10.0 (build_id 15261927)"
  exit 0
fi
if [[ "\${1:-}" == "-list-avds" ]]; then
  echo "${avdName}"
  exit 0
fi
echo "$$" > "$STATE_DIR/fake-emulator-pid"
trap 'echo terminated > "$STATE_DIR/fake-emulator-terminated"; exit 0' TERM INT
while true; do
  sleep 1
done
`
  );

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ANDROID_AVD_HOME: avdHome,
    ANDROID_HOME: sdkRoot,
    ANDROID_SDK_ROOT: sdkRoot,
    BACI_ANDROID_EMULATOR_LOG: path.join(stateDir, 'emulator.log'),
    BACI_FAKE_ANDROID_STATE_DIR: stateDir,
    HOME: root,
  };

  return {
    cleanup: () => {
      const pidPath = path.join(stateDir, 'fake-emulator-pid');
      if (existsSync(pidPath)) {
        const pid = Number.parseInt(readFileSync(pidPath, 'utf8'), 10);
        if (Number.isFinite(pid)) {
          try {
            process.kill(-pid, 'SIGKILL');
          } catch {
            try {
              process.kill(pid, 'SIGKILL');
            } catch {
              // The launcher may already have terminated the fake emulator.
            }
          }
        }
      }
      rmSync(root, { force: true, recursive: true });
    },
    env,
    stateDir,
  };
}

function runScript(
  scriptName: string,
  harness: Harness,
  env: EnvOverrides = {}
) {
  return spawnSync('bash', [path.join(scriptsRoot, scriptName)], {
    cwd: appRoot,
    encoding: 'utf8',
    env: { ...harness.env, ...env },
    timeout: 10_000,
  });
}

describe('Android emulator launcher (storefront)', () => {
  it('launches the dev client through fake adb and Metro reverse', () => {
    const harness = createHarness();
    try {
      const result = runScript('launch-android-dev-client.sh', harness);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Android dev client ready');
      const reverseLog = readFileSync(path.join(harness.stateDir, 'reverse-ran'), 'utf8');
      const activityLog = readFileSync(path.join(harness.stateDir, 'am-ran'), 'utf8');
      expect(reverseLog).toContain('tcp:8082 tcp:8082');
      expect(activityLog).toContain('android.intent.action.VIEW');
    } finally {
      harness.cleanup();
    }
  });

  it('fails cleanly when adb server start stalls before boot probes', () => {
    const harness = createHarness();
    try {
      const result = runScript('launch-android-emulator.sh', harness, {
        BACI_ANDROID_ADB_SERVER_TIMEOUT_SECONDS: '0.1',
        BACI_FAKE_ADB_START_STALL: '1',
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Timed out starting adb server within 0.1s');
      expect(existsSync(path.join(harness.stateDir, 'fake-emulator-pid'))).toBe(false);
    } finally {
      harness.cleanup();
    }
  });

  it('waits for the previous emulator to disappear before relaunching', () => {
    const harness = createHarness();
    try {
      writeFileSync(path.join(harness.stateDir, 'device-present'), '1');
      const result = runScript('launch-android-emulator.sh', harness, {
        BACI_ANDROID_ADB_SERVER_TIMEOUT_SECONDS: '1',
        BACI_ANDROID_OLD_EMULATOR_SHUTDOWN_TIMEOUT_SECONDS: '1',
        BACI_FAKE_ADB_KEEP_DEVICE_AFTER_KILL: '1',
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'Previous emulator on emulator-5554 did not shut down within 1s'
      );
      expect(existsSync(path.join(harness.stateDir, 'fake-emulator-pid'))).toBe(false);
    } finally {
      harness.cleanup();
    }
  });
  it('rejects nonnumeric Android load probes', () => {
    const harness = createHarness();
    try {
      const result = runScript('launch-android-dev-client.sh', harness, {
        BACI_ANDROID_LAUNCH_SETTLE_TIMEOUT_SECONDS: '1',
        BACI_FAKE_ADB_LOADAVG: 'not-ready',
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Android did not settle below load');
    } finally {
      harness.cleanup();
    }
  });
  it(
    'terminates the detached emulator process group on SIGINT',
    async () => {
      const harness = createHarness();
      const child = spawn('bash', [path.join(scriptsRoot, 'launch-android-emulator.sh')], {
        cwd: appRoot,
        env: {
          ...harness.env,
          BACI_ANDROID_BOOT_TIMEOUT_SECONDS: '30',
          BACI_FAKE_ADB_BOOT_COMPLETED: '0',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      try {
        let stdout = '';
        let sawEmulatorPid = false;
        const childStdout = child.stdout;
        if (!childStdout) {
          throw new Error('Expected launcher stdout to be piped.');
        }
        const exitPromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
          (resolve) => {
            child.on('exit', (code, signal) => resolve({ code, signal }));
          }
        );
        await new Promise<void>((resolve, reject) => {
          child.on('error', reject);
          child.on('exit', () => {
            if (!sawEmulatorPid) {
              reject(new Error(stdout));
            }
          });
          childStdout.on('data', (chunk: Buffer) => {
            stdout += chunk.toString('utf8');
            if (stdout.includes('Emulator PID:')) {
              sawEmulatorPid = true;
              child.kill('SIGINT');
              resolve();
            }
          });
        });
        const exit = await exitPromise;
        expect(exit.code).toBe(130);
        expect(existsSync(path.join(harness.stateDir, 'fake-emulator-terminated'))).toBe(
          true
        );
      } finally {
        child.kill('SIGKILL');
        harness.cleanup();
      }
    },
    12_000
  );
});
