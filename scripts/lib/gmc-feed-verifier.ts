/**
 * GMC feed image verification I/O.
 *
 * CDN filesystem checks and HTTP probes for the backfill script.
 * This module is Node.js-only (fs, fetch) and runs exclusively on the VPS.
 */

import { existsSync } from 'node:fs';
import {
  getImageFormat,
  replaceAvifWithJpg,
} from '../../packages/shared/src/gmc-feed/index';

export interface VerificationResult {
  status:
    | 'verified'
    | 'missing'
    | 'invalid'
    | 'pending_derivative'
    | 'pending_verification';
  verified_url: string | null;
  verified_format: string | null;
  failure_reason: string | null;
}

const CDN_HOST = 'cdn.ogabassey.com';

const CONTENT_TYPE_TO_FORMAT: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Verify a CDN-hosted image by checking the local filesystem.
 *
 * Maps `https://cdn.ogabassey.com/core-assets/...` to the local path
 * under `cdnBasePath`. For AVIF sources, checks if a sibling `.jpg`
 * derivative exists.
 *
 * @param fileExistsFn Injectable for testing — defaults to `fs.existsSync`
 */
export function verifyCdnImage(
  sourceUrl: string,
  cdnBasePath: string,
  fileExistsFn: (path: string) => boolean = existsSync
): VerificationResult {
  const url = new URL(sourceUrl);
  const localPath = `${cdnBasePath}${url.pathname}`;
  const format = getImageFormat(sourceUrl);

  // AVIF: check sibling .jpg derivative
  if (format === 'avif') {
    const jpgPath = localPath.replace(/\.avif$/i, '.jpg');
    const jpgUrl = replaceAvifWithJpg(sourceUrl);

    if (fileExistsFn(jpgPath)) {
      return {
        status: 'verified',
        verified_url: jpgUrl,
        verified_format: 'jpeg',
        failure_reason: null,
      };
    }
    return {
      status: 'pending_derivative',
      verified_url: jpgUrl,
      verified_format: 'jpeg',
      failure_reason: null,
    };
  }

  // JPG/PNG/WebP: check file exists
  if (fileExistsFn(localPath)) {
    return {
      status: 'verified',
      verified_url: sourceUrl,
      verified_format: format,
      failure_reason: null,
    };
  }

  return {
    status: 'missing',
    verified_url: null,
    verified_format: null,
    failure_reason: `File not found on CDN: ${url.pathname}`,
  };
}

/**
 * Verify a remote image URL via HTTP HEAD (with GET fallback on 405).
 *
 * @param fetchFn Injectable for testing — defaults to global `fetch`
 */
export async function verifyRemoteImage(
  url: string,
  fetchFn: typeof fetch = globalThis.fetch
): Promise<VerificationResult> {
  try {
    let response = await fetchFn(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10_000),
    });

    // Fallback to GET if server doesn't support HEAD
    if (response.status === 405) {
      response = await fetchFn(url, {
        method: 'GET',
        signal: AbortSignal.timeout(10_000),
      });
    }

    if (!response.ok) {
      const isTransient = response.status >= 500;
      return {
        status: isTransient ? 'pending_verification' : 'missing',
        verified_url: null,
        verified_format: null,
        failure_reason: `HTTP ${response.status} for ${url}`,
      };
    }

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || '';
    const format = CONTENT_TYPE_TO_FORMAT[contentType];

    if (!format) {
      return {
        status: 'invalid',
        verified_url: null,
        verified_format: null,
        failure_reason: `Non-feed-safe content-type: ${contentType} for ${url}`,
      };
    }

    return {
      status: 'verified',
      verified_url: url,
      verified_format: format,
      failure_reason: null,
    };
  } catch (err) {
    return {
      status: 'pending_verification',
      verified_url: null,
      verified_format: null,
      failure_reason: `${(err as Error).message} for ${url}`,
    };
  }
}

/**
 * Check if a URL is hosted on the CDN.
 */
export function isCdnUrl(url: string): boolean {
  try {
    return new URL(url).hostname === CDN_HOST;
  } catch {
    return false;
  }
}
