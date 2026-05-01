import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const MIN_NPROC_LIMIT = 512;

test('systemd unit leaves enough process headroom for Node and Sharp', async () => {
  const unit = await readFile(
    new URL('./baci-cdn-transformer.service', import.meta.url),
    'utf8'
  );
  const limitMatch = unit.match(/^LimitNPROC=(\d+)$/m);

  assert.ok(limitMatch, 'Expected baci-cdn-transformer.service to set LimitNPROC');
  assert.ok(
    Number.parseInt(limitMatch[1], 10) >= MIN_NPROC_LIMIT,
    'LimitNPROC must leave room for system processes plus Node/Sharp worker threads'
  );
});
