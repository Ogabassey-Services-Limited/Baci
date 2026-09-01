import { describe, expect, it } from 'vitest';
import { releaseSafeText } from './release-safe-text-schema';

describe('releaseSafeText', () => {
  it('accepts bounded text without unstable links or media', () => {
    expect(releaseSafeText(32, 'Policy').safeParse('Returns are accepted').success)
      .toBe(true);
  });

  it('rejects query-bearing media with the subject-specific issue', () => {
    const result = releaseSafeText(128, 'Product').safeParse(
      '<img src="https://cdn.example/image.png?token=secret">'
    );

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.map(({ message }) => message)).toContain(
        'Product links and media must be release-safe'
      );
  });

  it('rejects text beyond the supplied length bound', () => {
    expect(releaseSafeText(4, 'Policy').safeParse('12345').success).toBe(false);
  });
});
