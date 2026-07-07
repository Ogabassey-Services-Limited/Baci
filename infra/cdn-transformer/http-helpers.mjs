import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { pipeline } from 'node:stream';
import { buildCorsHeaders, CONTENT_TYPES } from './config.mjs';

// Injectable dependencies for serveFile — mirrors the deps pattern in
// transform-cache.mjs so the client-abort teardown is unit-testable without
// standing up a real socket.
const defaultServeFileDeps = { createReadStream };

// Client-disconnect variants that are NOT real streaming failures on this
// high-abort image endpoint: a graceful early close (pipeline's own code), a
// TCP reset (mobile network switch / tab close), or a write after the socket
// is already gone. Swallowing these keeps the logs signal-only — the previous
// incident was prolonged by misleading error output, so log hygiene matters.
const BENIGN_STREAM_ABORT_CODES = new Set([
  'ERR_STREAM_PREMATURE_CLOSE',
  'ECONNRESET',
  'EPIPE',
]);

export function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(message);
}

export function sendOptions(response) {
  response.writeHead(204, {
    ...buildCorsHeaders(),
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Max-Age': '86400',
  });
  response.end();
}

function buildImageHeaders(
  fileStat,
  outputFormat,
  { varyAccept = false } = {}
) {
  const headers = {
    ...buildCorsHeaders(),
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Length': String(fileStat.size),
    'Content-Type': CONTENT_TYPES[outputFormat],
    ETag: `"${fileStat.size.toString(16)}-${Math.floor(fileStat.mtimeMs).toString(16)}"`,
    'X-Content-Type-Options': 'nosniff',
  };

  if (varyAccept) {
    headers.Vary = 'Accept';
  }

  return headers;
}

export async function sendImageHead(
  response,
  filePath,
  outputFormat,
  headerOptions
) {
  const fileStat = await stat(filePath);
  response.writeHead(
    200,
    buildImageHeaders(fileStat, outputFormat, headerOptions)
  );
  response.end();
}

export async function serveFile(
  response,
  filePath,
  outputFormat,
  headerOptions,
  deps = defaultServeFileDeps
) {
  const fileStat = await stat(filePath);
  response.writeHead(
    200,
    buildImageHeaders(fileStat, outputFormat, headerOptions)
  );

  const stream = deps.createReadStream(filePath);
  // pipeline (NOT .pipe()) so the file stream is destroyed when the response
  // side ends early: .pipe() never tears down its source on client aborts, so
  // every disconnected download leaked the cache file's descriptor — measured
  // in production at ~1-2 fds/min organic (and thousands under bulk load),
  // exhausting the 4096 ceiling in days and failing ALL transforms with
  // EMFILE ("Input file contains unsupported image format" from sharp).
  pipeline(stream, response, (error) => {
    // No error, or the client simply went away mid-download — nothing to
    // answer, and these abort variants are not real streaming failures.
    if (!error || BENIGN_STREAM_ABORT_CODES.has(error.code)) {
      return;
    }
    // The 200 status + headers were already flushed before streaming began,
    // so we cannot send an error status here; tear the response down so the
    // socket doesn't hang half-written.
    console.error('Failed to stream transformed image', error);
    response.destroy(error);
  });
}
