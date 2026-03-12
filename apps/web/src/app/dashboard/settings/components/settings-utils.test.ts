import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractColorsFromImage, sanitizeSocialMedia } from './settings-utils';

const mockGetPaletteSync = vi.fn();

vi.mock('colorthief', () => ({
  getPaletteSync: (...args: unknown[]) => mockGetPaletteSync(...args),
}));

describe('settings-utils', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockGetPaletteSync.mockReset();
  });

  it('extracts primary and accent colors from the colorthief palette', async () => {
    const image = {
      crossOrigin: '',
      onload: null as null | (() => void),
      onerror: null as null | (() => void),
      src: '',
    };

    vi.spyOn(document, 'createElement').mockReturnValue(
      image as unknown as HTMLImageElement
    );

    mockGetPaletteSync.mockReturnValue([
      { array: () => [17, 34, 51] },
      { array: () => [68, 85, 102] },
    ]);

    const extraction = extractColorsFromImage('data:image/png;base64,abc');
    image.onload?.();

    await expect(extraction).resolves.toEqual({
      primary: '#112233',
      background: '#FFFFFF',
      accent: '#445566',
    });
  });

  it('falls back to black when the palette is empty', async () => {
    const image = {
      crossOrigin: '',
      onload: null as null | (() => void),
      onerror: null as null | (() => void),
      src: '',
    };

    vi.spyOn(document, 'createElement').mockReturnValue(
      image as unknown as HTMLImageElement
    );

    mockGetPaletteSync.mockReturnValue(null);

    const extraction = extractColorsFromImage('data:image/png;base64,abc');
    image.onload?.();

    await expect(extraction).resolves.toEqual({
      primary: '#000000',
      background: '#FFFFFF',
      accent: '#000000',
    });
  });

  it('rejects when the image cannot be loaded', async () => {
    const image = {
      crossOrigin: '',
      onload: null as null | (() => void),
      onerror: null as null | (() => void),
      src: '',
    };

    vi.spyOn(document, 'createElement').mockReturnValue(
      image as unknown as HTMLImageElement
    );

    const extraction = extractColorsFromImage('data:image/png;base64,abc');
    image.onerror?.();

    await expect(extraction).rejects.toThrow(
      'Image could not be loaded for color extraction.'
    );
  });

  it('trims and sanitizes social media fields', () => {
    expect(
      sanitizeSocialMedia({
        instagram: '  <b>@baci</b>  ',
      })
    ).toEqual({
      instagram: '@baci',
    });
  });
});
