import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import process from 'node:process';
import { HOST, PORT } from './config.mjs';
import {
  sendImageHead,
  sendOptions,
  sendText,
  serveFile,
} from './http-helpers.mjs';
import { parseRequestPath, pickFormat } from './request-parser.mjs';
import { buildCachePath, ensureTransformed } from './transform-cache.mjs';

async function handleImageRequest(request, response, parsedRequest) {
  const sourceStat = await stat(parsedRequest.absoluteSourcePath);
  if (!sourceStat.isFile()) {
    sendText(response, 404, 'Not found');
    return;
  }

  const outputFormat = pickFormat(
    parsedRequest.options.format,
    request.headers.accept || '',
    parsedRequest.extension
  );
  const cachePath = buildCachePath({
    options: parsedRequest.options,
    outputFormat,
    sourcePath: parsedRequest.sourcePath,
    sourceStat,
  });

  try {
    await stat(cachePath);
  } catch {
    await ensureTransformed(
      parsedRequest.absoluteSourcePath,
      cachePath,
      parsedRequest.options,
      outputFormat
    );
  }

  if (request.method === 'HEAD') {
    await sendImageHead(response, cachePath, outputFormat);
    return;
  }

  await serveFile(response, cachePath, outputFormat);
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') {
      sendOptions(response);
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendText(response, 405, 'Method not allowed');
      return;
    }

    const parsedRequest = parseRequestPath(request.url || '/');
    if (parsedRequest.healthCheck) {
      sendText(response, 200, 'ok');
      return;
    }
    if (parsedRequest.error) {
      sendText(response, parsedRequest.statusCode, parsedRequest.error);
      return;
    }

    await handleImageRequest(request, response, parsedRequest);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      sendText(response, 404, 'Not found');
      return;
    }

    if (Number.isInteger(error?.statusCode)) {
      sendText(response, error.statusCode, error.message);
      return;
    }

    console.error('Image transform failed', error);
    sendText(response, 500, 'Image transform failed');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Baci CDN transformer listening on http://${HOST}:${PORT}`);
});

let isShuttingDown = false;
function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`Received ${signal}; shutting down Baci CDN transformer`);
  const forcedExit = setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
  forcedExit.unref();

  server.close((error) => {
    clearTimeout(forcedExit);
    if (error) {
      console.error('Shutdown failed', error);
      process.exit(1);
    }

    console.log('Baci CDN transformer stopped');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
