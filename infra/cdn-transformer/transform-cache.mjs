import { createHash } from 'node:crypto';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import {
  CACHE_ROOT,
  MAX_CONCURRENT_TRANSFORMS,
  MAX_TRANSFORM_SIZE_BYTES,
  TRANSFORM_TIMEOUT_MS,
} from './config.mjs';

export { MAX_CONCURRENT_TRANSFORMS } from './config.mjs';

const transformInProgress = new Map();
const transformQueue = [];
export const MAX_PENDING_TRANSFORMS = MAX_CONCURRENT_TRANSFORMS * 4;
let activeTransforms = 0;

const defaultTransformDeps = {
  maxTransformSizeBytes: MAX_TRANSFORM_SIZE_BYTES,
  mkdir,
  rename,
  sharpFactory: sharp,
  stat,
  transformTimeoutMs: TRANSFORM_TIMEOUT_MS,
  unlink,
};

function createTransformQueueFullError() {
  const error = new Error('Image transform queue is full');
  error.statusCode = 503;
  return error;
}

function releaseTransformSlot() {
  activeTransforms = Math.max(0, activeTransforms - 1);
  const nextTransform = transformQueue.shift();
  if (nextTransform) {
    nextTransform();
  }
}

function logCleanupError(error) {
  console.warn('Failed to remove temporary transform file', error);
}

function acquireTransformSlot() {
  if (activeTransforms < MAX_CONCURRENT_TRANSFORMS) {
    activeTransforms += 1;
    return releaseTransformSlot;
  }

  if (transformQueue.length >= MAX_PENDING_TRANSFORMS) {
    return Promise.reject(createTransformQueueFullError());
  }

  return new Promise((resolve) => {
    transformQueue.push(() => {
      activeTransforms += 1;
      resolve(releaseTransformSlot);
    });
  });
}

function writeImageWithTimeout(image, tempPath, timeoutMs) {
  let timeoutId;
  const timeoutError = new Error(
    `Image transform timed out after ${timeoutMs}ms`
  );
  timeoutError.statusCode = 504;
  const transform = image.toFile(tempPath);
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      try {
        image.destroy(timeoutError);
      } catch (error) {
        console.warn('Failed to abort timed-out transform', error);
      }
      reject(timeoutError);
    }, timeoutMs);
  });

  return {
    completion: transform.catch(() => undefined).finally(() => {
      clearTimeout(timeoutId);
    }),
    result: Promise.race([transform, timeout]).finally(() => {
      clearTimeout(timeoutId);
    }),
  };
}

export function buildCachePath({
  sourcePath,
  sourceStat,
  options,
  outputFormat,
}) {
  const hash = createHash('sha256')
    .update(sourcePath)
    .update('\0')
    .update(String(sourceStat.size))
    .update('\0')
    .update(String(sourceStat.mtimeMs))
    .update('\0')
    .update(JSON.stringify(options))
    .update('\0')
    .update(outputFormat)
    .digest('hex');

  return path.join(CACHE_ROOT, `${hash}.${outputFormat}`);
}

function startTransformImage(
  sourcePath,
  cachePath,
  options,
  outputFormat,
  deps = defaultTransformDeps
) {
  let markComplete;
  const completionPromise = new Promise((resolve) => {
    markComplete = resolve;
  });
  let completed = false;
  function completeOnce() {
    if (completed) {
      return;
    }

    completed = true;
    markComplete();
  }

  const clientPromise = (async () => {
    let release;
    let releaseInFinally = true;
    let tempPath;
    let writeCompletion = Promise.resolve();
    try {
      const sourceStat = await deps.stat(sourcePath);
      if (sourceStat.size > deps.maxTransformSizeBytes) {
        const error = new Error('Source image is too large to transform');
        error.statusCode = 413;
        throw error;
      }

      release = await acquireTransformSlot();
      tempPath = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
      await deps.mkdir(path.dirname(cachePath), { recursive: true });

      // GIF is not a supported source extension; preserve animation for WebP inputs.
      const shouldPreserveAnimation =
        outputFormat === 'webp' &&
        path.extname(sourcePath).toLowerCase() === '.webp';
      const image = deps
        .sharpFactory(sourcePath, {
          animated: shouldPreserveAnimation,
        })
        .rotate()
        .resize({
          fit: options.fit,
          height: options.height,
          kernel: sharp.kernel.lanczos3,
          withoutEnlargement: true,
          width: options.width,
        });

      if (outputFormat === 'avif') {
        image.avif({ effort: 4, quality: options.quality });
      } else if (outputFormat === 'webp') {
        image.webp({ effort: 4, quality: options.quality });
      } else if (outputFormat === 'png') {
        image.png({ compressionLevel: 9 });
      } else {
        image.jpeg({ mozjpeg: true, quality: options.quality });
      }

      const write = writeImageWithTimeout(
        image,
        tempPath,
        deps.transformTimeoutMs
      );
      writeCompletion = write.completion;

      await write.result;
      await deps.rename(tempPath, cachePath);
    } catch (error) {
      if (error?.statusCode === 504 && release) {
        releaseInFinally = false;
        void writeCompletion
          .finally(() => deps.unlink(tempPath).catch(logCleanupError))
          .finally(() => {
            release();
            completeOnce();
          });
        throw error;
      }

      if (tempPath) {
        await deps.unlink(tempPath).catch(logCleanupError);
      }
      throw error;
    } finally {
      if (releaseInFinally) {
        release?.();
        completeOnce();
      }
    }
  })();

  return { clientPromise, completionPromise };
}

function createPendingTransformEntry() {
  let resolveClient;
  let rejectClient;
  let resolveCompletion;
  const clientPromise = new Promise((resolve, reject) => {
    resolveClient = resolve;
    rejectClient = reject;
  });
  const completionPromise = new Promise((resolve) => {
    resolveCompletion = resolve;
  });

  return {
    clientPromise,
    completionPromise,
    rejectClient,
    resolveClient,
    resolveCompletion,
  };
}

export async function ensureTransformed(
  sourcePath,
  cachePath,
  options,
  outputFormat,
  deps = defaultTransformDeps
) {
  const existingTransform = transformInProgress.get(cachePath);
  if (existingTransform) {
    await existingTransform.clientPromise;
    return;
  }

  const pendingTransform = createPendingTransformEntry();
  transformInProgress.set(cachePath, pendingTransform);
  void pendingTransform.completionPromise.finally(() => {
    if (transformInProgress.get(cachePath) === pendingTransform) {
      transformInProgress.delete(cachePath);
    }
  });

  try {
    const transform = startTransformImage(
      sourcePath,
      cachePath,
      options,
      outputFormat,
      deps
    );
    void transform.clientPromise.then(
      pendingTransform.resolveClient,
      pendingTransform.rejectClient
    );
    void transform.completionPromise.finally(
      pendingTransform.resolveCompletion
    );
  } catch (error) {
    // Defensive path for future synchronous startTransformImage setup failures.
    // Current async failures flow through clientPromise/completionPromise above.
    pendingTransform.rejectClient(error);
    pendingTransform.resolveCompletion();
  }

  await pendingTransform.clientPromise;
}
