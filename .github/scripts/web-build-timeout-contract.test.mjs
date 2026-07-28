import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import YAML from 'yaml';

test('gives the bounded storefront build enough time to finish page-data collection', async () => {
  const workflow = YAML.parse(await readFile('.github/workflows/ci.yml', 'utf8'));

  assert.equal(workflow.jobs.build.name, 'Build');
  assert.equal(workflow.jobs.build['timeout-minutes'], 45);
});
