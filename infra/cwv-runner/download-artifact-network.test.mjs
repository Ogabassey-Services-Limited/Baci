import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceHelper = fileURLToPath(
  new URL('download-artifact.sh', import.meta.url)
);
const harness = mkdtempSync(join(tmpdir(), 'cwv-download-network-harness-'));
const timeoutShim = join(harness, 'timeout');
const helper = join(harness, 'download-artifact.sh');
writeFileSync(
  timeoutShim,
  // biome-ignore lint/suspicious/noTemplateCurlyInString: fixture emits POSIX parameter expansion literally.
  '#!/bin/sh\n[ "$1" = --preserve-status ] && shift\nduration=${1%s}; shift\n"$@" & child=$!\n(\ntimer=\ncleanup() { test -z "$timer" || { kill "$timer" 2>/dev/null || true; wait "$timer" 2>/dev/null || true; }; exit 0; }\ntrap cleanup HUP INT TERM\nsleep "$duration" & timer=$!\nwait "$timer"\ntimer=\nkill "$child" 2>/dev/null || true\n) & watcher=$!\nwait "$child"; status=$?\nkill "$watcher" 2>/dev/null || true\nwait "$watcher" 2>/dev/null || true\nexit "$status"\n'
);
chmodSync(timeoutShim, 0o700);
writeFileSync(
  helper,
  readFileSync(sourceHelper, 'utf8')
    .replaceAll('/usr/bin/timeout', timeoutShim)
    .replaceAll('/usr/bin/curl', 'curl')
    .replaceAll('/usr/bin/getent', 'getent')
);
const maxArtifactBytes = '8';
const expectedContentTypes = '["application/octet-stream"]';

function fixture(answerSource) {
  const dir = mkdtempSync(join(tmpdir(), 'cwv-bound-download-'));
  const resolutionCount = join(dir, 'resolution-count');
  const contacted = join(dir, 'contacted');
  const getent = join(dir, 'getent');
  const curl = join(dir, 'curl');
  const timeout = join(dir, 'timeout');
  writeFileSync(
    getent,
    `#!/bin/bash\nn=$(cat ${JSON.stringify(resolutionCount)} 2>/dev/null || printf 0)\nprintf '%s' $((n + 1)) >${JSON.stringify(resolutionCount)}\n${answerSource}\n`
  );
  writeFileSync(
    timeout,
    '#!/bin/bash\n[ "$1" = --preserve-status ] && shift\nshift\nexec "$@"\n'
  );
  writeFileSync(
    curl,
    `#!/bin/bash
resolve=
noproxy=
proxy=unset
while [ "$#" -gt 0 ]; do
  case "$1" in
    --resolve) resolve=$2; shift 2 ;;
    --noproxy) noproxy=$2; shift 2 ;;
    --proxy) proxy=$2; shift 2 ;;
    --output) output=$2; shift 2 ;;
    --dump-header) headers=$2; shift 2 ;;
    --write-out|--connect-timeout|--speed-limit|--speed-time|--max-time|--max-filesize|--proto|--proto-redir) shift 2 ;;
    --*) shift ;;
    *) url=$1; shift ;;
  esac
done
[ "$resolve" = allowed.test:443:8.8.8.8 ] || exit 91
[ "$noproxy" = '*' ] || exit 92
[ "$proxy" = '' ] || exit 93
printf yes >${JSON.stringify(contacted)}
printf 'HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\n\r\n' >"$headers"
printf payload >"$output"
printf '200\n%s\n8.8.8.8' "$url"
`
  );
  chmodSync(getent, 0o700);
  chmodSync(curl, 0o700);
  chmodSync(timeout, 0o700);
  return { contacted, dir, resolutionCount };
}

test('artifact download binds one DNS answer to the direct TLS connection', () => {
  const value = fixture(
    '[ "$n" -eq 0 ] && printf "8.8.8.8 STREAM allowed.test\\n" || printf "10.0.0.1 STREAM allowed.test\\n"'
  );
  const result = spawnSync(
    '/bin/sh',
    [
      helper,
      'https://allowed.test/file',
      '239f59ed55e737c77147cf55ad0c1b030b6d7ee748a7426952f9b852d5a935e5',
      '["https://allowed.test"]',
      join(value.dir, 'artifact'),
      maxArtifactBytes,
      expectedContentTypes,
    ],
    { env: { ...process.env, PATH: `${value.dir}:${process.env.PATH}` } }
  );
  assert.equal(result.status, 0, result.stderr.toString());
  assert.equal(readFileSync(value.resolutionCount, 'utf8'), '1');
  assert.equal(readFileSync(value.contacted, 'utf8'), 'yes');
});

test('artifact download rejects the complete answer set before contact', () => {
  const value = fixture(
    'printf "8.8.8.8 STREAM allowed.test\\n10.0.0.1 STREAM allowed.test\\n"'
  );
  const result = spawnSync(
    '/bin/sh',
    [
      helper,
      'https://allowed.test/file',
      '0'.repeat(64),
      '["https://allowed.test"]',
      join(value.dir, 'artifact'),
      maxArtifactBytes,
      expectedContentTypes,
    ],
    { env: { ...process.env, PATH: `${value.dir}:${process.env.PATH}` } }
  );
  assert.notEqual(result.status, 0);
  assert.throws(() => readFileSync(value.contacted));
});

test('artifact download checks the connected remote address', () => {
  const source = readFileSync(sourceHelper, 'utf8');
  assert.match(source, /--resolve/);
  assert.match(source, /remote_ip/);
  assert.match(source, /selected_ip/);
});

test('one deadline bounds DNS, headers, and bodies without resetting after resolution', () => {
  const source = readFileSync(sourceHelper, 'utf8');
  assert.match(source, /deadline_seconds=120/);
  assert.match(source, /\/usr\/bin\/timeout --preserve-status "\$2"/);
  assert.doesNotMatch(source, /command -v timeout|timeout_command/);
  assert.match(
    source,
    /remaining=\$\(remaining_timeout\)[\s\S]*resolve_once[\s\S]*remaining=\$\(remaining_timeout\)/
  );
});

function boundedFixture({ dnsDelay, phase }) {
  const dir = mkdtempSync(join(tmpdir(), 'cwv-download-deadline-'));
  const bounded = join(dir, 'download-artifact.sh');
  writeFileSync(
    bounded,
    readFileSync(helper, 'utf8').replace(
      'deadline_seconds=120',
      'deadline_seconds=2'
    )
  );
  for (const [name, source] of Object.entries({
    getent:
      dnsDelay === 0
        ? '#!/bin/sh\nprintf "8.8.8.8 STREAM allowed.test\\n"\n'
        : dnsDelay === 1
          ? '#!/bin/sh\nsleep 1\nprintf "8.8.8.8 STREAM allowed.test\\n"\n'
          : `#!${process.execPath}\nsetTimeout(() => process.stdout.write('8.8.8.8 STREAM allowed.test\\n'), ${dnsDelay * 1000});\n`,
    timeout: `#!/bin/sh\n[ "$1" = --preserve-status ] && shift\nduration=\${1%s}; shift\n"$@" & child=$!\n(\ntimer=\ncleanup() { test -z "$timer" || { kill "$timer" 2>/dev/null || true; wait "$timer" 2>/dev/null || true; }; exit 0; }\ntrap cleanup HUP INT TERM\nsleep "$duration" & timer=$!\nwait "$timer"\ntimer=\nkill "$child" 2>/dev/null || true\n) & watcher=$!\nwait "$child"; status=$?\nkill "$watcher" 2>/dev/null || true\nwait "$watcher" 2>/dev/null || true\nexit "$status"\n`,
    curl: `#!/bin/sh\nwhile [ "$#" -gt 0 ]; do case "$1" in --max-time) limit=$2; shift 2 ;; --output) output=$2; shift 2 ;; --dump-header) headers=$2; shift 2 ;; --write-out|--connect-timeout|--speed-limit|--speed-time|--max-filesize|--proto|--proto-redir|--resolve) shift 2 ;; --*) shift ;; *) url=$1; shift ;; esac; done\nprintf '%s' "$limit" >${JSON.stringify(join(dir, 'curl-limit'))}\n[ ${JSON.stringify(phase)} = body ] && printf 'HTTP/1.1 200 OK\\r\\nContent-Type: application/octet-stream\\r\\n\\r\\n' >"$headers"\nsleep "$limit"\nexit 28\n`,
  })) {
    const path = join(dir, name);
    writeFileSync(path, source);
    chmodSync(path, 0o700);
  }
  return { bounded, dir };
}

test('delayed DNS, headers, and bodies consume one local deadline', () => {
  for (const [dnsDelay, phase] of [
    [3, 'dns'],
    [1, 'dns-consumed'],
    [0, 'headers'],
    [0, 'body'],
  ]) {
    const value = boundedFixture({ dnsDelay, phase });
    const result = spawnSync(
      '/bin/sh',
      [
        value.bounded,
        'https://allowed.test/file',
        '239f59ed55e737c77147cf55ad0c1b030b6d7ee748a7426952f9b852d5a935e5',
        '["https://allowed.test"]',
        join(value.dir, 'artifact'),
        maxArtifactBytes,
        expectedContentTypes,
      ],
      { env: { ...process.env, PATH: `${value.dir}:${process.env.PATH}` } }
    );
    assert.notEqual(result.status, 0);
  }
});
