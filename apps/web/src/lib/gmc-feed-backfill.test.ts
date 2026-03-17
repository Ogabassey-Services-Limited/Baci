import { describe, expect, it } from 'vitest';
import {
  type BackfillImageCandidate,
  classifyFeedImageCandidate,
  extractImageCandidates,
} from '@/lib/gmc-feed-backfill';

/**
 * Smoke tests verifying the re-export shim from `@baci/shared/gmc-feed`.
 * Full classification/extraction coverage lives in
 * `packages/shared/src/gmc-feed/gmc-feed.test.ts`.
 */

describe('gmc-feed-backfill re-export shim', () => {
  it('extractImageCandidates is callable and returns expected shape', () => {
    const result = extractImageCandidates('prod-1', [
      'https://cdn.ogabassey.com/core-assets/products/phone.jpg',
    ]);
    expect(result).toEqual([
      {
        product_id: 'prod-1',
        source_url: 'https://cdn.ogabassey.com/core-assets/products/phone.jpg',
        is_primary: true,
        position: 0,
      },
    ]);
  });

  it('classifyFeedImageCandidate is callable and returns expected shape', () => {
    const candidate: BackfillImageCandidate = {
      product_id: 'prod-1',
      source_url: 'https://cdn.ogabassey.com/core-assets/products/phone.jpg',
      is_primary: true,
      position: 0,
    };
    const result = classifyFeedImageCandidate(
      candidate,
      'https://ogabassey.com'
    );
    expect(result.status).toBe('pending_verification');
    expect(result.product_id).toBe('prod-1');
  });

  it('detects format correctly when URL has fragment', () => {
    const candidate: BackfillImageCandidate = {
      product_id: 'prod-1',
      source_url:
        'https://cdn.ogabassey.com/core-assets/products/phone.png#section',
      is_primary: true,
      position: 0,
    };
    const result = classifyFeedImageCandidate(
      candidate,
      'https://ogabassey.com'
    );
    expect(result.status).toBe('pending_verification');
    expect(result.verified_url).toBeNull();
    expect(result.verified_format).toBeNull();
  });
});
