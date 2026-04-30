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

async function writeImageWithTimeout(image, tempPath, timeoutMs) {
  let timedOut = false;
  let timeoutId;
  const timeoutError = new Error(
    `Image transform timed out after ${timeoutMs}ms`
  );
  timeoutError.statusCode = 504;
  const transform = image.toFile(tempPath);
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      try {
        image.destroy(timeoutError);
      } catch (error) {
        console.warn('Failed to abort timed-out transform', error);
      }
      reject(timeoutError);
    }, timeoutMs);
  });

  try {
    return await Promise.race([transform, timeout]);
  } catch (error) {
    if (timedOut) {
      await transform.catch(() => undefined);
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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

async function transformImage(
  sourcePath,
  cachePath,
  options,
  outputFormat,
  deps = defaultTransformDeps
) {
  const sourceStat = await deps.stat(sourcePath);
  if (sourceStat.size > deps.maxTransformSizeBytes) {
    const error = new Error('Source image is too large to transform');
    error.statusCode = 413;
    throw error;
  }

  const release = await acquireTransformSlot();
  const tempPath = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
  try {
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

    await writeImageWithTimeout(image, tempPath, deps.transformTimeoutMs);
    await deps.rename(tempPath, cachePath);
  } catch (error) {
    await deps.unlink(tempPath).catch(logCleanupError);
    throw error;
  } finally {
    release();
  }
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
    await existingTransform;
    return;
  }

  const transform = transformImage(
    sourcePath,
    cachePath,
    options,
    outputFormat,
    deps
  ).finally(() => {
    transformInProgress.delete(cachePath);
  });

  transformInProgress.set(cachePath, transform);
  await transform;
}
