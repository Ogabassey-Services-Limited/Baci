import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const imageId = `sha256:${'b'.repeat(64)}`;

async function runFixture(command) {
  const directory = await mkdtemp(join(tmpdir(), 'baci-running-container-'));
  try {
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `. "$1"; SCRIPT_DIR=$(dirname "$1"); RETIRE_OLLAMA_TMPDIR="$2"; init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/run/docker.sock; ${command}`,
      'running-container-test',
      script.pathname,
      directory,
    ]);
    return stdout;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const metadataDocker = `docker() { case "$*" in *'inspect -f {{.Name}} generic-api'*) printf '%s\\n' '/generic-api';; *'inspect -f {{json .State.Running}} generic-api'*) printf '%s\\n' 'true';; *'inspect -f {{.Image}} generic-api'*) printf '%s\\n' '${imageId}';; *'inspect -f {{json .Path}} generic-api'*) printf '%s\\n' '"/docker-entrypoint"';; *'inspect -f {{json .Config.WorkingDir}} generic-api'*) printf '%s\\n' '""';; *'inspect -f {{json .Args}} generic-api'*) printf '%s\\n' '["--model","llama3.2:latest"]';; *'inspect -f {{json .Config.Env}} generic-api'*) printf '%s\\n' '["NODE_VERSION=22.14.0","MODEL=llama3.2:latest","DOCKER_SOCK=/var/run/docker.sock"]';; *'inspect -f {{json .Config.Healthcheck}} generic-api'*) printf '%s\\n' '{"Test":["CMD-SHELL","curl -fsS http://127.0.0.1:8080/health"]}';; *'inspect -f {{json .Mounts}} generic-api'*) printf '%s\\n' '[{"Type":"bind","Source":"/var/run/docker.sock","Destination":"/var/run/docker.sock"}]';; *' cp '*) printf 'unexpected docker cp\\n' >&2; return 91;;`;

test('emits digest-bound evidence when the immutable running image contains Ollama markers', async () => {
  const output = await runFixture(
    `${metadataDocker} *'image save ${imageId}'*) printf '%s\\n' 'filesystem endpoint=http://127.0.0.1:11434';; *) return 2;; esac; }; load_consumer_scanners; running_container_validate generic-api /generic-api 'stable-config'`
  );
  assert.match(
    output,
    /^running-container-image:[0-9a-f]{64}\|[0-9a-f]{64}\|[0-9a-f]{64}$/m
  );
  assert.doesNotMatch(output, /filesystem|11434/);
});

test('accepts a safe absolute running-container argument', async () => {
  const absoluteArgument = metadataDocker.replace(
    '["--model","llama3.2:latest"]',
    '["/etc/application.conf"]'
  );
  const output = await runFixture(
    `${absoluteArgument} *'image save ${imageId}'*) printf '%s\\n' 'filesystem';; *) return 2;; esac; }; load_consumer_scanners; running_container_validate generic-api /generic-api 'stable-config'`
  );
  assert.equal(output, '');
});

test('exports one immutable image twice for two containers sharing its ID', async () => {
  const sharedImageDocker = metadataDocker.replace(
    'docker() { case "$*" in',
    'docker() { case "$*" in *generic-two*) set -- $(printf \'%s\\n\' "$*" | /usr/bin/sed \'s/generic-two/generic-api/g\');; esac; case "$*" in'
  );
  const output = await runFixture(
    `save_count="$2/save-count"; ${sharedImageDocker} *'image save ${imageId}'*) count=$(cat "$save_count" 2>/dev/null || printf 0); count=$((count + 1)); printf '%s' "$count" >"$save_count"; printf '%s\\n' 'filesystem endpoint=http://127.0.0.1:11434';; *) return 2;; esac; }; load_consumer_scanners; running_container_validate generic-api /generic-api 'stable-one'; running_container_validate generic-two /generic-api 'stable-two'; [ "$(cat "$save_count")" -eq 2 ]`
  );
  assert.equal(output.match(/^running-container-image:/gm)?.length, 2);
});

test('fails closed when immutable running-image saves drift', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'baci-running-container-drift-')
  );
  try {
    await assert.rejects(
      execFileAsync('sh', [
        '-c',
        `. "$1"; SCRIPT_DIR=$(dirname "$1"); RETIRE_OLLAMA_TMPDIR="$2"; init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/run/docker.sock; ${metadataDocker} *'image save ${imageId}'*) if [ ! -e '${directory}/seen' ]; then : >'${directory}/seen'; printf first; else printf second; fi;; *) return 2;; esac; }; load_consumer_scanners; running_container_validate generic-api /generic-api 'stable-config'`,
        'running-container-drift-test',
        script.pathname,
        directory,
      ]),
      (error) => error.code === 2
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('fails closed when immutable running-image save fails', async () => {
  await assert.rejects(
    runFixture(
      `save_marker="$2/save-seen"; ${metadataDocker} *'image save ${imageId}'*) if [ ! -e "$save_marker" ]; then : >"$save_marker"; printf '%s' first; else return 73; fi;; *) return 2;; esac; }; load_consumer_scanners; running_container_validate generic-api /generic-api 'stable-config'`
    ),
    (error) => error.code === 2
  );
});

test('fails closed when the retained running-image archive exceeds the byte limit', async () => {
  await assert.rejects(
    runFixture(
      `${metadataDocker} *'image save ${imageId}'*) printf '%s' '0123456789';; *) return 2;; esac; }; load_consumer_scanners; RUNNING_CONTAINER_IMAGE_MAX_BYTES=8; running_container_validate generic-api /generic-api 'stable-config'`
    ),
    (error) => error.code === 2
  );
});

test('fails closed when a running-image export hangs past the watchdog', async () => {
  await assert.rejects(
    runFixture(
      `${metadataDocker} *'image save ${imageId}'*) exec sleep 120;; *) return 2;; esac; }; load_consumer_scanners; RUNNING_CONTAINER_IMAGE_SAVE_TIMEOUT_SECONDS=1; running_container_validate generic-api /generic-api 'stable-config'`
    ),
    (error) => error.code === 2
  );
});

test('shares one deadline across both immutable running-image saves', async () => {
  await assert.rejects(
    runFixture(
      `first_save="$2/first-save"; second_save="$2/second-save"; ${metadataDocker} *'image save ${imageId}'*) if [ ! -e "$first_save" ]; then : >"$first_save"; else : >"$second_save"; fi; printf '%s\\n' 'filesystem';; *) return 2;; esac; }; load_consumer_scanners; running_container_now() { [ -e "$second_save" ] && printf '%s\\n' 3 || printf '%s\\n' 1; }; RUNNING_CONTAINER_IMAGE_SAVE_TIMEOUT_SECONDS=2; running_container_validate generic-api /generic-api 'stable-config'`
    ),
    (error) => error.code === 2
  );
});

test('rejects a running container with a noncanonical DOCKER_SOCK scalar', async () => {
  const noncanonical = metadataDocker.replace(
    '["NODE_VERSION=22.14.0","MODEL=llama3.2:latest","DOCKER_SOCK=/var/run/docker.sock"]',
    '["NODE_VERSION=22.14.0","MODEL=llama3.2:latest","DOCKER_SOCK=/tmp/docker.sock"]'
  );
  await assert.rejects(
    runFixture(
      `${noncanonical} *'image save ${imageId}'*) printf '%s\\n' 'filesystem';; *) return 2;; esac; }; load_consumer_scanners; running_container_validate generic-api /generic-api 'stable-config'`
    ),
    (error) => error.code === 2
  );
});

test('rejects duplicate canonical DOCKER_SOCK entries', async () => {
  const duplicate = metadataDocker.replace(
    '["NODE_VERSION=22.14.0","MODEL=llama3.2:latest","DOCKER_SOCK=/var/run/docker.sock"]',
    '["NODE_VERSION=22.14.0","MODEL=llama3.2:latest","DOCKER_SOCK=/var/run/docker.sock","DOCKER_SOCK=/run/docker.sock"]'
  );
  await assert.rejects(
    runFixture(
      `${duplicate} *'image save ${imageId}'*) printf '%s\\n' 'filesystem';; *) return 2;; esac; }; load_consumer_scanners; running_container_validate generic-api /generic-api 'stable-config'`
    ),
    (error) => error.code === 2
  );
});

test('rejects newline-bearing running-container environment strings', async () => {
  const newlineEnv = metadataDocker.replace(
    '["NODE_VERSION=22.14.0","MODEL=llama3.2:latest","DOCKER_SOCK=/var/run/docker.sock"]',
    '["DOCKER_SOCK=/var/run/docker.sock\\nFOO=bad"]'
  );
  await assert.rejects(
    runFixture(
      `${newlineEnv} *'image save ${imageId}'*) printf '%s\\n' 'filesystem';; *) return 2;; esac; }; load_consumer_scanners; running_container_validate generic-api /generic-api 'stable-config'`
    ),
    (error) => error.code === 2
  );
});

// The stub flips on read six: one initial read, two validator reads, and two
// validator rechecks must remain true before the final binding comparison.
test('fails closed when a running container stops before the final stable-state reads', async () => {
  const stateFileSetup = 'state_file="$2/state"; ';
  const transitioning = metadataDocker.replace(
    "*'inspect -f {{json .State.Running}} generic-api'*) printf '%s\\n' 'true';;",
    '*\'inspect -f {{json .State.Running}} generic-api\'*) count=$(cat "$state_file" 2>/dev/null || printf 0); count=$((count + 1)); printf \'%s\' "$count" >"$state_file"; [ "$count" -le 5 ] && printf \'%s\\n\' true || printf \'%s\\n\' false;;'
  );
  await assert.rejects(
    runFixture(
      `${stateFileSetup}${transitioning} *'image save ${imageId}'*) printf '%s\\n' 'filesystem endpoint=http://127.0.0.1:11434';; *) return 2;; esac; }; load_consumer_scanners; container_configuration() { printf '%s\\n' stable-config; }; container_bind_mount_consumers() { :; }; container_scan_bindings generic-api /generic-api stable-config`
    ),
    (error) => error.code === 2
  );
});
