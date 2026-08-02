import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { sealedPaths } from './image-process-map.mjs';

const root = new URL('./', import.meta.url);
const helperName = 'cwv-runner-stable-attestation-builder.mjs';
const canonical = new URL(`../../.github/scripts/${helperName}`, root);
const projected = new URL(helperName, root);
const dockerfile = readFileSync(new URL('Dockerfile', root), 'utf8');
const archiveAuthority = readFileSync(
  new URL('image-archive-authority.mjs', root),
  'utf8'
);

test('projects the reviewed stable-attestation helper through every sealed image boundary', () => {
  assert.equal(existsSync(canonical), true, 'canonical helper source');
  assert.equal(existsSync(projected), true, 'projected helper source');
  assert.deepEqual(readFileSync(projected), readFileSync(canonical));
  assert.ok(sealedPaths.includes(`/opt/baci-cwv/${helperName}`));
  assert.match(
    dockerfile,
    new RegExp(`COPY[^\\n]*${helperName}[^\\n]*\\/opt\\/baci-cwv\\/`)
  );
  assert.match(dockerfile, new RegExp(`baci_paths=\\([^)]*${helperName}`, 's'));
  assert.match(archiveAuthority, new RegExp(`'${helperName}'`));
});
