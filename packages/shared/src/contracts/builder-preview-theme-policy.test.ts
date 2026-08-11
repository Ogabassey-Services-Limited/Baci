import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { builderDesignCapabilities } from './builder-design-capabilities';
import { builderPreviewCandidateConfigSchema } from './builder-preview-candidate-config';

const reservedColorGroups = ['button', 'card', 'footer', 'header', 'input'];
let originalThemeTokenKeys: string[];

function candidate(theme?: unknown) {
  return builderPreviewCandidateConfigSchema.safeParse({
    content: [],
    root: { props: { title: 'Home' } },
    ...(theme === undefined ? {} : { theme }),
  });
}

describe('preview theme policy', () => {
  beforeEach(() => {
    originalThemeTokenKeys = [...builderDesignCapabilities.themeTokenKeys];
  });

  afterEach(() => {
    builderDesignCapabilities.themeTokenKeys.splice(
      0,
      builderDesignCapabilities.themeTokenKeys.length,
      ...originalThemeTokenKeys
    );
    vi.restoreAllMocks();
  });

  it('caches a manifest-derived shape until an in-place token change', () => {
    builderDesignCapabilities.themeTokenKeys.push('cacheProbe');
    const fromEntries = vi.spyOn(Object, 'fromEntries');
    const baseTheme = { colors: { cacheProbe: '#123456' } };

    expect(candidate(baseTheme).success).toBe(true);
    expect(candidate(baseTheme).success).toBe(true);
    expect(fromEntries).toHaveBeenCalledTimes(1);

    builderDesignCapabilities.themeTokenKeys.push('previewSurface');
    expect(candidate({ colors: { previewSurface: '#123456' } }).success).toBe(
      true
    );
    expect(
      candidate({ colors: { previewSurface: 'url(https://bad.test/pixel)' } })
        .success
    ).toBe(false);
    expect(fromEntries).toHaveBeenCalledTimes(2);
  });

  it('does not allocate a theme shape when the candidate supplies no theme', () => {
    const fromEntries = vi.spyOn(Object, 'fromEntries');

    expect(candidate().success).toBe(true);
    expect(fromEntries).not.toHaveBeenCalled();
  });

  it('accepts only CSS-supported three, four, six, and eight digit hex colors', () => {
    for (const color of ['#123', '#1234', '#123456', '#12345678']) {
      expect(candidate({ colors: { primary: color } }).success).toBe(true);
    }
    for (const color of ['#12', '#12345', '#1234567', '#123456789']) {
      expect(candidate({ colors: { primary: color } }).success).toBe(false);
    }
  });

  it('rejects reserved manifest token collisions with a clear diagnostic', () => {
    for (const token of reservedColorGroups) {
      builderDesignCapabilities.themeTokenKeys.push(token);
      const result = candidate({ colors: { primary: '#123456' } });

      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe(
          `Preview theme manifest token "${token}" collides with a reserved color group.`
        );
      builderDesignCapabilities.themeTokenKeys.pop();
    }
  });
});
