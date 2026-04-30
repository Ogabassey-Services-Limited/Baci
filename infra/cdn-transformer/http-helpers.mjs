import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { buildCorsHeaders, CONTENT_TYPES } from './config.mjs';

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

function buildImageHeaders(fileStat, outputFormat) {
  return {
    ...buildCorsHeaders(),
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Length': String(fileStat.size),
    'Content-Type': CONTENT_TYPES[outputFormat],
    ETag: `"${fileStat.size.toString(16)}-${Math.floor(fileStat.mtimeMs).toString(16)}"`,
    Vary: 'Accept',
    'X-Content-Type-Options': 'nosniff',
  };
}

export async function sendImageHead(response, filePath, outputFormat) {
  const fileStat = await stat(filePath);
  response.writeHead(200, buildImageHeaders(fileStat, outputFormat));
  response.end();
}

export async function serveFile(response, filePath, outputFormat) {
  const fileStat = await stat(filePath);
  response.writeHead(200, buildImageHeaders(fileStat, outputFormat));

  const stream = createReadStream(filePath);
  stream.on('error', (error) => {
    console.error('Failed to stream transformed image', error);
    if (response.headersSent) {
      response.destroy(error);
      return;
    }

    response.writeHead(500, {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end('Image stream failed');
  });
  stream.pipe(response);
}
