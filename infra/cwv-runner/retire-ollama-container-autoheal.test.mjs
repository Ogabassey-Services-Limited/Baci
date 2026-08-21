import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

async function runFixture(command) {
  const dir = await mkdtemp(join(tmpdir(), 'baci-retire-ollama-autoheal-'));
  try {
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `. "$1"; SCRIPT_DIR=$(dirname "$1"); RETIRE_OLLAMA_TMPDIR="$2"; init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/run/docker.sock; ${command}`,
      'fixture',
      script.pathname,
      dir,
    ]);
    return stdout;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('ignores a stable canonical Docker socket bind instead of treating it as config', async () => {
  const output = await runFixture(
    `docker() { case "$*" in *'inspect -f {{json .Mounts}} generic-api'*) printf '%s\\n' '[{"Type":"bind","Source":"/var/run/docker.sock","Destination":"/var/run/docker.sock"}]';; *) return 2;; esac; }; load_consumer_scanners; container_bind_mount_consumers generic-api`
  );
  assert.equal(output, '');
});

test('does not docker-cp runtime PATH or DOCKER_SOCK values from a running container', async () => {
  const output = await runFixture(
    `docker() { case "$*" in *'inspect -f {{json .Mounts}} generic-api'*) printf '%s\\n' '[{"Type":"bind","Source":"/var/run/docker.sock","Destination":"/var/run/docker.sock"}]';; *'inspect -f {{json .Config.Env}} generic-api'*) printf '%s\\n' '["PATH=/usr/bin:/bin","DOCKER_SOCK=/var/run/docker.sock"]';; *'inspect -f {{json .Config.WorkingDir}} generic-api'*) printf '%s\\n' '""';; *'inspect -f {{json .State.Running}} generic-api'*) printf '%s\\n' 'true';; *' cp '*) printf 'unexpected docker cp\\n' >&2; return 91;; *) return 2;; esac; }; load_consumer_scanners; container_environment_consumers generic-api 'generic-api /generic-api /usr/bin/application [] ["PATH=/usr/bin:/bin","DOCKER_SOCK=/var/run/docker.sock"] "" {} null [] {} {} {} [] "bridge"'`
  );
  assert.equal(output, '');
});

test('does not copy lexical Ollama metadata from a running container', async () => {
  const output = await runFixture(
    `docker() { case "$*" in *'inspect -f {{json .Mounts}} generic-api'*) printf '%s\\n' '[]';; *'inspect -f {{json .Config.Env}} generic-api'*) printf '%s\\n' '["PATH=/usr/bin:/bin","OLLAMA_HOST=http://127.0.0.1:11434"]';; *'inspect -f {{json .Config.WorkingDir}} generic-api'*) printf '%s\\n' '""';; *'inspect -f {{json .State.Running}} generic-api'*) printf '%s\\n' 'true';; *' cp '*) printf 'unexpected docker cp\\n' >&2; return 91;; *) return 2;; esac; }; load_consumer_scanners; container_environment_consumers generic-api 'generic-api /generic-api /usr/bin/application [] ["PATH=/usr/bin:/bin","OLLAMA_HOST=http://127.0.0.1:11434"] "" {} null [] {} {} {} [] "bridge"'`
  );
  assert.equal(output, '');
});

test('allows only canonical Docker socket environment values', async () => {
  for (const socket of ['/var/run/docker.sock', '/run/docker.sock']) {
    const output = await runFixture(
      `docker() { case "$*" in *'inspect -f {{json .Mounts}} generic-api'*) printf '%s\\n' '[{"Type":"bind","Source":"/var/run/docker.sock","Destination":"${socket}"}]';; *'inspect -f {{json .Config.Env}} generic-api'*) printf '%s\\n' '["DOCKER_SOCK=${socket}"]';; *'inspect -f {{json .Config.WorkingDir}} generic-api'*) printf '%s\\n' '""';; *' cp '*) return 91;; *) return 2;; esac; }; load_consumer_scanners; container_environment_consumers generic-api 'generic-api /generic-api /usr/bin/application [] ["DOCKER_SOCK=${socket}"] "" {} null [] {} {} {} [] "bridge"'`
    );
    assert.equal(output, '');
  }
  await assert.rejects(
    runFixture(
      `docker() { case "$*" in *'inspect -f {{json .Config.Env}} generic-api'*) printf '%s\\n' '["DOCKER_SOCK=/tmp/docker.sock"]';; *'inspect -f {{json .Config.WorkingDir}} generic-api'*) printf '%s\\n' '""';; *'inspect -f {{json .State.Running}} generic-api'*) printf '%s\\n' 'true';; *) return 2;; esac; }; load_consumer_scanners; container_environment_consumers generic-api 'generic-api /generic-api /usr/bin/application [] ["DOCKER_SOCK=/tmp/docker.sock"] "" {} null [] {} {} {} [] "bridge"'`
    ),
    (error) => error.code === 2
  );
  await assert.rejects(
    runFixture(
      `docker() { case "$*" in *'inspect -f {{json .Mounts}} generic-api'*) printf '%s\\n' '[]';; *'inspect -f {{json .Config.Env}} generic-api'*) printf '%s\\n' '["DOCKER_SOCK=/var/run/docker.sock"]';; *'inspect -f {{json .Config.WorkingDir}} generic-api'*) printf '%s\\n' '""';; *) return 2;; esac; }; load_consumer_scanners; container_environment_consumers generic-api 'generic-api /generic-api /usr/bin/application [] ["DOCKER_SOCK=/var/run/docker.sock"] "" {} null [] {} {} {} [] "bridge"'`
    ),
    (error) => error.code === 2
  );
});

test('does not let a duplicate PATH value hide a running config path', async () => {
  await assert.rejects(
    runFixture(
      `docker() { case "$*" in *'inspect -f {{json .Config.Env}} generic-api'*) printf '%s\\n' '["PATH=/etc/app.conf","CONFIG=/etc/app.conf"]';; *'inspect -f {{json .Config.WorkingDir}} generic-api'*) printf '%s\\n' '""';; *'inspect -f {{json .State.Running}} generic-api'*) printf '%s\\n' 'true';; *) return 2;; esac; }; load_consumer_scanners; container_environment_consumers generic-api 'generic-api /generic-api /usr/bin/application [] ["PATH=/etc/app.conf","CONFIG=/etc/app.conf"] "" {} null [] {} {} {} [] "bridge"'`
    ),
    (error) => error.code === 2
  );
});

test('excludes PATH before file-path validation', async () => {
  const output = await runFixture(
    `docker() { case "$*" in *'inspect -f {{json .Config.Env}} generic-api'*) printf '%s\\n' '["PATH=/usr/$UNEXPANDED/bin"]';; *'inspect -f {{json .Config.WorkingDir}} generic-api'*) printf '%s\\n' '""';; *' cp '*) return 91;; *) return 2;; esac; }; load_consumer_scanners; container_environment_consumers generic-api 'generic-api /generic-api /usr/bin/application [] ["PATH=/usr/$UNEXPANDED/bin"] "" {} null [] {} {} {} [] "bridge"'`
  );
  assert.equal(output, '');
});

test('propagates an unsafe environment result through the container snapshot', async () => {
  await assert.rejects(
    runFixture(
      `docker() { case "$*" in *'inspect -f {{.Name}} generic-api'*) printf '%s\\n' '/generic-api';; *'inspect -f {{json .Config.Env}} generic-api'*) printf '%s\\n' '["DOCKER_SOCK=/tmp/docker.sock"]';; *'inspect -f {{json .Config.WorkingDir}} generic-api'*) printf '%s\\n' '""';; *'inspect -f {{json .State.Running}} generic-api'*) printf '%s\\n' 'true';; *) return 2;; esac; }; load_consumer_scanners; container_configuration() { printf '%s\\n' 'generic-api /generic-api /usr/bin/application [] ["DOCKER_SOCK=/tmp/docker.sock"] "" {} null [] {} {} {} [] "bridge"'; }; container_configuration_network_mode() { :; }; container_bind_mount_consumers() { :; }; container_argument_consumers() { :; }; container_option_argument_consumers() { :; }; container_healthcheck_consumers() { :; }; raw=$(temp_path); printf '%s\\n' generic-api >"$raw"; scan_container_snapshot all "$raw"`
    ),
    (error) => error.code === 2
  );
});

test('accepts a running generic container with scalar metadata and immutable image evidence', async () => {
  const imageId = `sha256:${'a'.repeat(64)}`;
  const output = await runFixture(
    `docker() { case "$*" in *'inspect -f {{.Name}} generic-api'*) printf '%s\\n' '/generic-api';; *'inspect -f {{json .State.Running}} generic-api'*) printf '%s\\n' 'true';; *'inspect -f {{.Image}} generic-api'*) printf '%s\\n' '${imageId}';; *'inspect -f {{json .Path}} generic-api'*) printf '%s\\n' '"/docker-entrypoint"';; *'inspect -f {{json .Config.WorkingDir}} generic-api'*) printf '%s\\n' '""';; *'inspect -f {{json .Args}} generic-api'*) printf '%s\\n' '["--model","llama3.2:latest","--token","abc.def/ghi"]';; *'inspect -f {{json .Config.Env}} generic-api'*) printf '%s\\n' '["NODE_VERSION=22.14.0","MODEL=llama3.2:latest","TOKEN=abc.def/ghi","DOCKER_SOCK=/var/run/docker.sock"]';; *'inspect -f {{json .Config.Healthcheck}} generic-api'*) printf '%s\\n' '{"Test":["CMD-SHELL","curl -fsS http://127.0.0.1:8080/health"]}';; *'inspect -f {{json .Mounts}} generic-api'*) printf '%s\\n' '[{"Type":"bind","Source":"/var/run/docker.sock","Destination":"/var/run/docker.sock"}]';; *'image save ${imageId}'*) printf '%s\\n' 'image filesystem endpoint=http://127.0.0.1:11434';; *'container export generic-api'*) printf '%s\\n' 'clean live filesystem';; *' cp '*) printf 'unexpected docker cp\\n' >&2; return 91;; *) return 2;; esac; }; load_consumer_scanners; running_container_validate generic-api /generic-api 'generic-api /generic-api /docker-entrypoint ["--model","llama3.2:latest","--token","abc.def/ghi"] ["NODE_VERSION=22.14.0","MODEL=llama3.2:latest","TOKEN=abc.def/ghi","DOCKER_SOCK=/var/run/docker.sock"] "" {} {"Test":["CMD-SHELL","curl -fsS http://127.0.0.1:8080/health"]} [] {} {} {} [] "bridge"'`
  );
  assert.match(
    output,
    /^running-container-image:[0-9a-f]{64}\|[0-9a-f]{64}\|[0-9a-f]{64}$/m
  );
  assert.doesNotMatch(
    output,
    /abc\.def\/ghi|NODE_VERSION|image filesystem|11434|127\.0\.0\.1/
  );
});
