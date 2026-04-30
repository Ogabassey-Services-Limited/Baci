import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { HOST, PORT, PUBLIC_ROOT } from './config.mjs';
import {
  sendImageHead,
  sendOptions,
  sendText,
  serveFile,
} from './http-helpers.mjs';
import { parseRequestPath, pickFormat } from './request-parser.mjs';
import { buildCachePath, ensureTransformed } from './transform-cache.mjs';

const defaultImageRequestDeps = {
  buildCachePath,
  ensureTransformed,
  pickFormat,
  sendImageHead,
  serveFile,
  stat,
  realpath,
};

function isPathInsideRoot(filePath, rootPath) {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedPath = path.resolve(filePath);

  return (
    resolvedPath === resolvedRoot ||
    resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)
  );
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toPublicSourcePath(filePath, rootPath = PUBLIC_ROOT) {
  return path
    .relative(path.resolve(rootPath), path.resolve(filePath))
    .split(path.sep)
    .join('/');
}

async function resolveSourceFile(parsedRequest, deps) {
  const normalizedPublicRoot = path.resolve(PUBLIC_ROOT);
  const normalizedSourcePath = path.resolve(parsedRequest.absoluteSourcePath);
  if (!isPathInsideRoot(normalizedSourcePath, normalizedPublicRoot)) {
    throw createHttpError(404, 'Not found');
  }

  const realPublicRoot = path.resolve(await deps.realpath(PUBLIC_ROOT));
  const realSourcePath = path.resolve(
    await deps.realpath(normalizedSourcePath)
  );
  if (!isPathInsideRoot(realSourcePath, realPublicRoot)) {
    throw createHttpError(404, 'Not found');
  }

  return {
    absoluteSourcePath: realSourcePath,
    sourcePath: toPublicSourcePath(realSourcePath, realPublicRoot),
  };
}

export async function handleImageRequest(
  request,
  response,
  parsedRequest,
  deps = defaultImageRequestDeps
) {
  const verifiedSource = await resolveSourceFile(parsedRequest, deps);
  const sourceStat = await deps.stat(verifiedSource.absoluteSourcePath);
  if (!sourceStat.isFile()) {
    sendText(response, 404, 'Not found');
    return;
  }

  const outputFormat = deps.pickFormat(
    parsedRequest.options.format,
    request.headers.accept || '',
    parsedRequest.extension
  );
  const cachePath = deps.buildCachePath({
    options: parsedRequest.options,
    outputFormat,
    sourcePath: verifiedSource.sourcePath,
    sourceStat,
  });

  try {
    await deps.stat(cachePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }

    await deps.ensureTransformed(
      verifiedSource.absoluteSourcePath,
      cachePath,
      parsedRequest.options,
      outputFormat
    );
  }

  const imageHeaderOptions = {
    varyAccept: parsedRequest.options.format === 'auto',
  };

  if (request.method === 'HEAD') {
    await deps.sendImageHead(
      response,
      cachePath,
      outputFormat,
      imageHeaderOptions
    );
    return;
  }

  await deps.serveFile(response, cachePath, outputFormat, imageHeaderOptions);
}

export function createTransformerServer() {
  return createServer(async (request, response) => {
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
}

function attachShutdownHandlers(server) {
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
}

if (process.env.CDN_TRANSFORMER_AUTOSTART !== 'false') {
  const server = createTransformerServer();
  server.listen(PORT, HOST, () => {
    console.log(`Baci CDN transformer listening on http://${HOST}:${PORT}`);
  });
  attachShutdownHandlers(server);
}
