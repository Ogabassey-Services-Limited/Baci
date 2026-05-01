import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { sendImageHead } from './http-helpers.mjs';

function createResponseRecorder() {
  return {
    ended: false,
    headers: undefined,
    statusCode: undefined,
    end() {
      this.ended = true;
    },
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
  };
}

async function runSendImageHeadTest({ expectedVary, headerOptions }) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'baci-cdn-headers-'));
  try {
    const imagePath = path.join(tempDir, 'image.webp');
    await writeFile(imagePath, 'webp');
    const response = createResponseRecorder();

    await sendImageHead(response, imagePath, 'webp', headerOptions);

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers.Vary, expectedVary);
    assert.equal(response.headers['Content-Type'], 'image/webp');
    assert.equal(response.ended, true);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

test('sendImageHead omits Accept variation for fixed-format responses', async () => {
  await runSendImageHeadTest({
    expectedVary: undefined,
    headerOptions: undefined,
  });
});

test('sendImageHead keeps Accept variation for auto-format responses', async () => {
  await runSendImageHeadTest({
    expectedVary: 'Accept',
    headerOptions: { varyAccept: true },
  });
});
