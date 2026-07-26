// biome-ignore-all format: compact projection assertions remain one focused contract.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { sealedPaths } from './image-process-map.mjs';

const dockerfile = readFileSync(new URL('./Dockerfile', import.meta.url), 'utf8');

test('projects the exact-run process collector as a sealed image runtime leaf', () => {
  const collector = 'process-inventory.mjs';

  assert.ok(sealedPaths.includes(`/opt/baci-cwv/${collector}`));
  assert.match(
    dockerfile,
    new RegExp(`COPY[^\\n]*${collector}[^\\n]*\\/opt\\/baci-cwv\\/`)
  );
  assert.match(dockerfile, new RegExp(`baci_paths=\\([^)]*${collector}`, 's'));
});
