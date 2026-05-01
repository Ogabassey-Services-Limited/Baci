import assert from 'node:assert/strict';
import test from 'node:test';

const configUrl = new URL('./config.mjs', import.meta.url);

async function importConfigWithPort(rawPort) {
  const previousPort = process.env.CDN_TRANSFORMER_PORT;

  if (rawPort === undefined) {
    delete process.env.CDN_TRANSFORMER_PORT;
  } else {
    process.env.CDN_TRANSFORMER_PORT = rawPort;
  }

  try {
    return await import(
      `${configUrl.href}?port=${encodeURIComponent(String(rawPort))}-${Date.now()}-${Math.random()}`
    );
  } finally {
    if (previousPort === undefined) {
      delete process.env.CDN_TRANSFORMER_PORT;
    } else {
      process.env.CDN_TRANSFORMER_PORT = previousPort;
    }
  }
}

test('PORT defaults to 8095 when CDN_TRANSFORMER_PORT is unset', async () => {
  const config = await importConfigWithPort(undefined);

  assert.equal(config.PORT, 8095);
});

test('PORT accepts a valid numeric CDN_TRANSFORMER_PORT', async () => {
  const config = await importConfigWithPort('9090');

  assert.equal(config.PORT, 9090);
});

test('PORT accepts boundary values 1 and 65535', async () => {
  const minConfig = await importConfigWithPort('1');
  const maxConfig = await importConfigWithPort('65535');

  assert.equal(minConfig.PORT, 1);
  assert.equal(maxConfig.PORT, 65_535);
});

test('PORT rejects partially parsed, negative, whitespace, or out-of-range values', async () => {
  for (const rawPort of ['8095abc', '', '0', '65536', '-1', ' 8095', '8095 ']) {
    await assert.rejects(
      importConfigWithPort(rawPort),
      /Invalid CDN_TRANSFORMER_PORT/
    );
  }
});
