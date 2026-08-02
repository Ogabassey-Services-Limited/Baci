import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const collector = readFileSync(
  new URL('container-attest-runtime.mjs', import.meta.url)
);
const dockerfile = readFileSync(new URL('Dockerfile', import.meta.url), 'utf8');
const source = collector.toString('utf8');

test('projects the finalized runtime collector as an exact sealed runtime leaf', () => {
  assert.equal(
    createHash('sha256').update(collector).digest('hex'),
    '6393814fe6a1191847ef5cf75848a6d33908748064bed12df33a2f83d83f3262'
  );
  assert.match(
    dockerfile,
    /COPY infra\/cwv-runner\/container-attest-runtime\.mjs \/opt\/baci-cwv\/container-attest-runtime\.mjs/
  );
  assert.match(dockerfile, /baci_paths=\([^)]*container-attest-runtime\.mjs/s);
  assert.match(
    dockerfile,
    /for path in "\$\{baci_paths\[@\]\}"; do project_path "\/opt\/baci-cwv\/\$path" declared baci/
  );
  assert.match(source, /rootFile\('\/usr\/bin\/dpkg-query'\)/);
  assert.match(
    source,
    /'--show',[\s\S]*runtimeContract\.chrome\.debianPackage\.name/
  );
  assert.doesNotMatch(
    source,
    /pathToFileURL|canonicalRuntimeJson|await import/
  );
  assert.match(source, /rootFile\('\/opt\/baci-cwv\/canonical-json\.mjs'\)/);
});

test('probes pnpm through the computed projected program', () => {
  assert.match(source, /\[pnpmProgram\.executablePath, '--version'\]/);
});

test('binds dpkg-query to the projected runtime database', () => {
  assert.match(source, /`--root=\$\{runtimeRoot\}`/);
});

test('bounds every projected runtime probe with the sealed command boundary', () => {
  assert.match(source, /const COMMAND_ENV = Object\.freeze\(\{\}\)/);
  assert.match(source, /const COMMAND_MAX_BUFFER = 64 \* 1024/);
  assert.match(source, /const COMMAND_TIMEOUT_MS = 15_000/);
  assert.match(source, /env: COMMAND_ENV/);
  assert.match(source, /maxBuffer: COMMAND_MAX_BUFFER/);
  assert.match(source, /stdio: \['ignore', 'pipe', 'pipe'\]/);
  assert.match(source, /timeout: COMMAND_TIMEOUT_MS/);
});
