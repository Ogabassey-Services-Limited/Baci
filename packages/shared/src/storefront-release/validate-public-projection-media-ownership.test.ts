import { describe, expect, it, vi } from 'vitest';
import type { RefinementCtx } from 'zod';
import { validatePublicProjectionMediaOwnership } from './validate-public-projection-media-ownership';

const assetUrl = `/release-assets/${'a'.repeat(64)}.png`;

describe('validatePublicProjectionMediaOwnership', () => {
  it('reports a content-addressed asset missing from the media inventory', () => {
    const addIssue = vi.fn();

    validatePublicProjectionMediaOwnership(
      { body: `![Hero](${assetUrl})` },
      [],
      { addIssue } as unknown as RefinementCtx
    );

    expect(addIssue).toHaveBeenCalledWith({
      code: 'custom',
      message: 'Content-addressed release assets must resolve to payload.media',
      path: ['media'],
    });
  });

  it('accepts a content-addressed asset declared in the media inventory', () => {
    const addIssue = vi.fn();

    validatePublicProjectionMediaOwnership(
      { body: `![Hero](${assetUrl})` },
      [{ publicUrl: assetUrl }],
      { addIssue } as unknown as RefinementCtx
    );

    expect(addIssue).not.toHaveBeenCalled();
  });
});
