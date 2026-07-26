import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceHelper = fileURLToPath(
  new URL('download-artifact.sh', import.meta.url)
);
const harness = mkdtempSync(join(tmpdir(), 'cwv-download-harness-'));
const timeoutShim = join(harness, 'timeout');
const helper = join(harness, 'download-artifact.sh');
writeFileSync(
  timeoutShim,
  '#!/bin/sh\n[ "$1" = --preserve-status ] && shift\nshift\nexec "$@"\n'
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

const installResolver = (dir) => {
  const resolver = join(dir, 'getent');
  const timeout = join(dir, 'timeout');
  writeFileSync(resolver, '#!/bin/bash\nprintf "8.8.8.8 STREAM $2\\n"\n');
  writeFileSync(
    timeout,
    '#!/bin/bash\n[ "$1" = --preserve-status ] && shift\nshift\nexec "$@"\n'
  );
  chmodSync(resolver, 0o700);
  chmodSync(timeout, 0o700);
};

const fakeCurlSource = (response) => `#!/bin/bash
while [ "$#" -gt 0 ]; do
  case "$1" in
    --output) output=$2; shift 2 ;;
    --dump-header) headers=$2; shift 2 ;;
    --connect-timeout) connect_timeout=$2; shift 2 ;;
    --speed-time) speed_time=$2; shift 2 ;;
    --max-time) max_time=$2; shift 2 ;;
    --write-out|--max-redirs|--proto|--proto-redir|--speed-limit|--max-filesize|--resolve) shift 2 ;;
    --*) shift ;;
    *) url=$1; shift ;;
  esac
done
numeric_seconds='^[0-9]+([.][0-9]+)?$'
for seconds in "$connect_timeout" "$speed_time" "$max_time"; do [[ "$seconds" =~ $numeric_seconds ]] || exit 95; done
${response}
`;

test('fake curl parser accepts numeric seconds and rejects alphabetic suffixes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cwv-curl-parser-'));
  const fakeCurl = join(dir, 'curl');
  writeFileSync(
    fakeCurl,
    fakeCurlSource(
      'printf "%s|%s|%s" "$connect_timeout" "$speed_time" "$max_time"'
    )
  );
  chmodSync(fakeCurl, 0o700);
  // biome-ignore format: the exact curl argv contract remains visible as one tuple.
  const numeric = [
    '--connect-timeout', '10', '--speed-time', '30',
    '--max-time', '119.000', 'https://allowed.test/file',
  ];
  // biome-ignore format: parser acceptance and exact captured values are one contract.
  assert.equal(execFileSync(fakeCurl, numeric, { encoding: 'utf8' }), '10|30|119.000');
  assert.notEqual(spawnSync(fakeCurl, numeric.with(1, '10s')).status, 0);
});

test('download helper normalizes final Content-Type before checksum and rename', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cwv-download-'));
  const fakeCurl = join(dir, 'curl');
  installResolver(dir);
  writeFileSync(
    fakeCurl,
    fakeCurlSource(
      'printf "HTTP/1.1 200 OK\\r\\ncOnTeNt-TyPe: Application/OCTET-STREAM; charset=binary\\r\\n\\r\\n" >"$headers"\nprintf payload >"$output"\nprintf "200\\n%s\\n8.8.8.8" "$url"'
    )
  );
  chmodSync(fakeCurl, 0o700);
  const digest =
    '239f59ed55e737c77147cf55ad0c1b030b6d7ee748a7426952f9b852d5a935e5';
  execFileSync(
    '/bin/sh',
    [
      helper,
      'https://allowed.test/start',
      digest,
      '["https://allowed.test"]',
      join(dir, 'artifact'),
      maxArtifactBytes,
      expectedContentTypes,
    ],
    {
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
    }
  );
  assert.equal(readFileSync(join(dir, 'artifact'), 'utf8'), 'payload');
});

test('download helper constrains initial and redirect protocols to HTTPS', () => {
  const source = readFileSync(sourceHelper, 'utf8');
  assert.match(source, /--proto '=https'/);
  assert.match(source, /--proto-redir '=https'/);
  assert.match(source, /--connect-timeout 10 --speed-limit/);
  assert.match(source, /--speed-time 30 --max-time/);
  assert.match(source, /--max-time "\$remaining"/);
  assert.match(source, /printf '%d\.%03d'/);
  // biome-ignore format: all curl-facing duration sources share one no-suffix contract.
  assert.doesNotMatch(source, /--(?:connect-timeout|speed-time) [0-9.]+[A-Za-z]|printf '%d\.%03d[A-Za-z]'/);
  assert.match(source, /\/usr\/bin\/timeout --preserve-status/);
  assert.match(source, /curl_command=\/usr\/bin\/curl/);
  assert.match(source, /resolver_command=\/usr\/bin\/getent/);
  assert.doesNotMatch(source, /command -v timeout|timeout_command/);
  assert.match(source, /allowed-content-types-json/);
  assert.match(source, /LC_ALL=C/);
  assert.doesNotMatch(source, /insecure|-k\b/);
});

test('download helper resolves a bare-origin relative redirect before contact', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cwv-download-redirect-'));
  const fakeCurl = join(dir, 'curl');
  installResolver(dir);
  writeFileSync(
    fakeCurl,
    fakeCurlSource(`
if [ "$url" = https://allowed.test ]; then
  printf 'HTTP/1.1 302 Found\\r\\nLocation: final\\r\\n\\r\\n' >"$headers"
  : >"$output"; printf '302\\n%s\\n8.8.8.8' "$url"
elif [ "$url" = https://allowed.test/final ]; then
  printf 'HTTP/1.1 200 OK\\r\\nContent-Type: application/octet-stream\\r\\n\\r\\n' >"$headers"
  printf payload >"$output"; printf '200\\n%s\\n8.8.8.8' "$url"
else exit 90; fi`)
  );
  chmodSync(fakeCurl, 0o700);
  const digest =
    '239f59ed55e737c77147cf55ad0c1b030b6d7ee748a7426952f9b852d5a935e5';
  execFileSync(
    '/bin/sh',
    [
      helper,
      'https://allowed.test',
      digest,
      '["https://allowed.test"]',
      join(dir, 'artifact'),
      maxArtifactBytes,
      expectedContentTypes,
    ],
    {
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
    }
  );
});

test('download helper refuses an unapproved redirect without contacting it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cwv-download-refuse-'));
  const fakeCurl = join(dir, 'curl');
  installResolver(dir);
  const contacted = join(dir, 'contacted');
  writeFileSync(
    fakeCurl,
    fakeCurlSource(`
if [ "$url" = https://allowed.test/start ]; then
  printf 'HTTP/1.1 302 Found\\r\\nLocation: https://other.test/final\\r\\n\\r\\n' >"$headers"
  : >"$output"; printf '302\\n%s\\n8.8.8.8' "$url"
else printf yes >${JSON.stringify(contacted)}; exit 90; fi`)
  );
  chmodSync(fakeCurl, 0o700);
  const result = spawnSync(
    '/bin/sh',
    [
      helper,
      'https://allowed.test/start',
      '0'.repeat(64),
      '["https://allowed.test"]',
      join(dir, 'artifact'),
      maxArtifactBytes,
      expectedContentTypes,
    ],
    {
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
    }
  );
  assert.notEqual(result.status, 0);
  assert.throws(() => readFileSync(contacted));
});

test('download helper rejects HTTP before invoking curl', () => {
  const result = spawnSync('/bin/sh', [
    helper,
    'http://bad.test/a',
    '0'.repeat(64),
    '[]',
    '/tmp/nope',
    maxArtifactBytes,
    expectedContentTypes,
  ]);
  assert.notEqual(result.status, 0);
});

test('download helper removes partial bytes on origin or checksum mismatch', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cwv-download-fail-'));
  const fakeCurl = join(dir, 'curl');
  installResolver(dir);
  writeFileSync(
    fakeCurl,
    fakeCurlSource(
      'printf "HTTP/1.1 200 OK\\r\\nContent-Type: application/octet-stream\\r\\n\\r\\n" >"$headers"\nprintf payload >"$output"\nprintf "200\\nhttps://other.test/file?secret=query\\n8.8.8.8"'
    )
  );
  chmodSync(fakeCurl, 0o700);
  const destination = join(dir, 'artifact');
  const result = spawnSync(
    '/bin/sh',
    [
      helper,
      'https://allowed.test/start?secret=input',
      '0'.repeat(64),
      '["https://allowed.test"]',
      destination,
      maxArtifactBytes,
      expectedContentTypes,
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
    }
  );
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.includes('secret'), false);
  assert.throws(() => readFileSync(destination));
});

test('download helper enforces the caller policy byte cap during and after transfer', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cwv-download-size-'));
  const fakeCurl = join(dir, 'curl');
  installResolver(dir);
  writeFileSync(
    fakeCurl,
    fakeCurlSource(
      'printf "HTTP/1.1 200 OK\\r\\nContent-Type: application/octet-stream\\r\\n\\r\\n" >"$headers"\nprintf 123456789 >"$output"\nprintf "200\\n%s\\n8.8.8.8" "$url"'
    )
  );
  chmodSync(fakeCurl, 0o700);
  const result = spawnSync(
    '/bin/sh',
    [
      helper,
      'https://allowed.test/file',
      '0'.repeat(64),
      '["https://allowed.test"]',
      join(dir, 'artifact'),
      maxArtifactBytes,
      expectedContentTypes,
    ],
    { env: { ...process.env, PATH: `${dir}:${process.env.PATH}` } }
  );
  assert.notEqual(result.status, 0);
  assert.throws(() => readFileSync(join(dir, 'artifact')));
});

test('download helper rejects a wrong response Content-Type before publication', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cwv-download-content-type-'));
  const fakeCurl = join(dir, 'curl');
  installResolver(dir);
  writeFileSync(
    fakeCurl,
    fakeCurlSource(
      'printf "HTTP/1.1 200 OK\\r\\nContent-Type: text/plain\\r\\n\\r\\n" >"$headers"\nprintf payload >"$output"\nprintf "200\\n%s\\n8.8.8.8" "$url"'
    )
  );
  chmodSync(fakeCurl, 0o700);
  const result = spawnSync(
    '/bin/sh',
    [
      helper,
      'https://allowed.test/file',
      '239f59ed55e737c77147cf55ad0c1b030b6d7ee748a7426952f9b852d5a935e5',
      '["https://allowed.test"]',
      join(dir, 'artifact'),
      maxArtifactBytes,
      expectedContentTypes,
    ],
    { env: { ...process.env, PATH: `${dir}:${process.env.PATH}` } }
  );
  assert.notEqual(result.status, 0);
  assert.throws(() => readFileSync(join(dir, 'artifact')));
});
