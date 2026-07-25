import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const directory = path.dirname(new URL(import.meta.url).pathname);

test('reads the public auditor App registration without a JWT-only installation endpoint', async () => {
  const source = await readFile(
    path.join(directory, 'verify-owner-cli.sh'),
    'utf8'
  );

  assert.match(
    source,
    /read-auditor-app-registration\) exec "\$gh" api --method GET -H "X-GitHub-Api-Version: \$API_VERSION" "\/apps\/baci-cwv-runner-auditor"/
  );
  assert.doesNotMatch(source, /\/repos\/\$REPOSITORY\/installation/);
  assert.doesNotMatch(
    source,
    /read-auditor-app-installation|read-auditor-app-permissions/
  );
});

test('only expects a duplicate ref create refusal after ruleset activation', async () => {
  const source = await readFile(
    path.join(directory, 'verify-owner-cli.sh'),
    'utf8'
  );
  const start = source.indexOf('(assert-owned-probe-duplicate-create)');
  const end = source.indexOf('\n    (assert-owned-probe-update|', start);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const duplicateCreate = source.slice(start, end);
  assert.match(duplicateCreate, /expect_refusal .* "\$ref_request"/);
  assert.doesNotMatch(duplicateCreate, /fresh/);
  assert.equal((duplicateCreate.match(/expect_refusal/g) ?? []).length, 1);

  assert.match(
    source,
    /\(assert-owned-probe-update\|assert-owned-probe-force-update\)[\s\S]*expect_refusal/
  );
  assert.match(source, /\(assert-owned-probe-delete\)[\s\S]*expect_refusal/);
});
