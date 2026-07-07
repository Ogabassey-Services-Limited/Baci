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

// Shared scaffolding for the serveFile client-abort tests: a cache image large
// enough not to drain in one tick, a deps wrapper that captures the source
// stream serveFile opens, a response that holds backpressure forever (so the
// source is still mid-stream when the client "leaves"), and a bounded wait for
// the source to close.
async function writeCacheImage(tempDir) {
  const imagePath = path.join(tempDir, 'image.webp');
  await writeFile(imagePath, Buffer.alloc(512 * 1024, 0x61));
  return imagePath;
}

function createCapturingDeps() {
  const capture = { stream: undefined };
  return {
    capture,
    deps: {
      createReadStream: (streamPath, options) => {
        capture.stream = createReadStream(streamPath, options);
        return capture.stream;
      },
    },
  };
}

function createStalledResponse() {
  // Never invokes the write callback → holds backpressure like a client that
  // stopped reading. writeHead is a no-op shim serveFile calls before streaming.
  const response = new Writable({
    highWaterMark: 1,
    write() {
      // Intentionally hold the callback so the source cannot drain.
    },
  });
  response.writeHead = () => undefined;
  return response;
}

async function waitForStreamClose(stream, timeoutMs = 1000) {
  let timer;
  const closed = await Promise.race([
    new Promise((resolve) => {
      if (stream.destroyed) {
        resolve(true);
        return;
      }
      stream.once('close', () => resolve(true));
    }),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    }),
  ]);
  clearTimeout(timer);
  return closed;
}

test('serveFile destroys the source stream when the client aborts mid-download (fd-leak regression)', async () => {
  // Production incident 2026-07-06: `stream.pipe(response)` never tears down
  // the file read stream when the client disconnects mid-download, so every
  // aborted request leaked the cache file's descriptor until EMFILE bricked
  // ALL transforms. `pipeline()` must destroy the source on early response
  // close. This asserts that teardown directly.
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'baci-cdn-stream-'));
  try {
    const imagePath = await writeCacheImage(tempDir);
    const { capture, deps } = createCapturingDeps();
    const response = createStalledResponse();

    // serveFile resolves once the read stream is created and the pipeline is
    // wired (it does not await streaming completion), so capture.stream is set.
    await serveFile(response, imagePath, 'webp', undefined, deps);
    assert.ok(capture.stream, 'expected serveFile to create a source stream');
    assert.equal(
      capture.stream.destroyed,
      false,
      'source stream should still be open before the client aborts'
    );

    // pipeline destroys the source with a premature-close error on client
    // abort; in production pipeline's own listeners absorb it (no crash). Do
    // the same here so inspecting the stream directly doesn't reject the test.
    capture.stream.on('error', () => undefined);

    // Client goes away mid-download. Fail FAST against unfixed code: with
    // stream.pipe(), destroying the response never tears down the source, so
    // 'close' never fires and the bounded wait returns false (a clear
    // assertion) instead of hanging to the global test timeout. On the fixed
    // (pipeline) path, close fires within milliseconds.
    response.destroy();
    const closed = await waitForStreamClose(capture.stream);
    assert.ok(
      closed && capture.stream.destroyed,
      'source read stream must be destroyed on client abort within 1s (else its fd leaks)'
    );
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test('serveFile does not log benign client-abort errors (ECONNRESET) as streaming failures', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'baci-cdn-reset-'));
  const originalError = console.error;
  const errors = [];
  console.error = (...args) => {
    errors.push(args);
  };
  try {
    const imagePath = await writeCacheImage(tempDir);
    const { capture, deps } = createCapturingDeps();
    const response = createStalledResponse();

    await serveFile(response, imagePath, 'webp', undefined, deps);
    capture.stream.on('error', () => undefined);

    // Simulate a client TCP reset mid-download rather than a graceful close.
    const reset = Object.assign(new Error('socket hang up'), {
      code: 'ECONNRESET',
    });
    response.destroy(reset);
    await waitForStreamClose(capture.stream);

    assert.equal(
      capture.stream.destroyed,
      true,
      'source stream must still be torn down on a reset'
    );
    assert.equal(
      errors.length,
      0,
      `benign client aborts must not be logged as failures (got: ${JSON.stringify(errors)})`
    );
  } finally {
    console.error = originalError;
    await rm(tempDir, { force: true, recursive: true });
  }
});
