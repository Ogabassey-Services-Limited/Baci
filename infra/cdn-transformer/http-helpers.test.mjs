import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import test from 'node:test';
import { sendImageHead, serveFile } from './http-helpers.mjs';

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

test('serveFile destroys the source stream when the client aborts mid-download (fd-leak regression)', async () => {
  // Production incident 2026-07-06: `stream.pipe(response)` never tears down
  // the file read stream when the client disconnects mid-download, so every
  // aborted request leaked the cache file's descriptor until EMFILE bricked
  // ALL transforms. `pipeline()` must destroy the source on early response
  // close. This asserts that teardown directly.
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'baci-cdn-stream-'));
  try {
    const imagePath = path.join(tempDir, 'image.webp');
    // Large enough that it will not drain in a single write tick.
    await writeFile(imagePath, Buffer.alloc(512 * 1024, 0x61));

    let capturedStream;
    const deps = {
      createReadStream: (streamPath, options) => {
        capturedStream = createReadStream(streamPath, options);
        return capturedStream;
      },
    };

    // A response that holds backpressure forever (never invokes the write
    // callback) — models a client that stopped reading. writeHead is a no-op
    // shim; serveFile calls it before streaming.
    const response = new Writable({
      highWaterMark: 1,
      write() {
        // Intentionally hold the callback so the source cannot drain.
      },
    });
    response.writeHead = () => undefined;

    // serveFile resolves once the read stream is created and the pipeline is
    // wired (it does not await streaming completion), so capturedStream is set.
    await serveFile(response, imagePath, 'webp', undefined, deps);
    assert.ok(capturedStream, 'expected serveFile to create a source stream');
    assert.equal(
      capturedStream.destroyed,
      false,
      'source stream should still be open before the client aborts'
    );

    // pipeline destroys the source with a premature-close error on client
    // abort; in production pipeline's own listeners absorb it (no crash). Do
    // the same here so inspecting the stream directly doesn't reject the test.
    capturedStream.on('error', () => undefined);

    // Client goes away mid-download.
    response.destroy();

    // Fail FAST and unambiguously against unfixed code: with stream.pipe(),
    // destroying the response never tears down the source, so 'close' never
    // fires and this would hang to the global test timeout. The bounded race
    // makes the regression surface as a clear assertion instead. On the fixed
    // (pipeline) path, close fires within milliseconds.
    let timer;
    const closed = await Promise.race([
      new Promise((resolve) => {
        if (capturedStream.destroyed) {
          resolve(true);
          return;
        }
        capturedStream.once('close', () => resolve(true));
      }),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), 1000);
      }),
    ]);
    clearTimeout(timer);
    assert.ok(
      closed && capturedStream.destroyed,
      'source read stream must be destroyed on client abort within 1s (else its fd leaks)'
    );
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});
