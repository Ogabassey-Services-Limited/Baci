import sanitizeLib from 'sanitize-html';
import { describe, expect, it } from 'vitest';
import { createSanitizeHtmlOptions } from '@/lib/sanitize-html-config';
import { stripDisallowedRawTextBlocks } from '@/lib/sanitize-raw-text-blocks';

describe('stripDisallowedRawTextBlocks', () => {
  it('strips raw text blocks before sanitize-html parses allowed neighbors', () => {
    const sanitized = sanitizeLib(
      stripDisallowedRawTextBlocks(
        '<p>Keep</p><script><img src=x onerror=alert(1)></script>'
      ),
      createSanitizeHtmlOptions()
    );

    expect(sanitized).toBe('<p>Keep</p>');
  });
});
