import { describe, expect, it } from 'vitest';
import { parseBrandColors } from './brand-colors';

describe('parseBrandColors', () => {
  it('returns a valid palette unchanged', () => {
    // Arrange
    const palette = {
      primary: '#000000',
      background: '#ffffff',
      accent: '#F59E0B',
    };

    // Act & Assert
    expect(parseBrandColors(palette)).toEqual(palette);
  });

  it('allows the optional secondary color used by persisted storefront palettes', () => {
    // Arrange
    const palette = {
      primary: '#000000',
      background: '#ffffff',
      accent: '#F59E0B',
      secondary: '#111111',
    };

    // Act & Assert
    expect(parseBrandColors(palette)).toEqual(palette);
  });

  it('rejects null', () => {
    // Act & Assert
    expect(parseBrandColors(null)).toBeNull();
  });

  it('rejects missing required color keys', () => {
    // Act & Assert
    expect(parseBrandColors({})).toBeNull();
  });

  it('rejects palettes with empty string values', () => {
    // Act & Assert
    expect(
      parseBrandColors({
        primary: '',
        background: '#ffffff',
        accent: '#F59E0B',
      })
    ).toBeNull();
  });

  it('rejects palettes with invalid color strings', () => {
    // Act & Assert
    expect(
      parseBrandColors({
        primary: 'not-a-color',
        background: '#ffffff',
        accent: '#F59E0B',
      })
    ).toBeNull();
  });

  it('rejects palettes with unknown extra properties', () => {
    // Act & Assert
    expect(
      parseBrandColors({
        primary: '#000000',
        background: '#ffffff',
        accent: '#F59E0B',
        extra: '#111111',
      })
    ).toBeNull();
  });

  it('rejects palettes with an invalid optional secondary color', () => {
    // Act & Assert
    expect(
      parseBrandColors({
        primary: '#000000',
        background: '#ffffff',
        accent: '#F59E0B',
        secondary: 'not-a-color',
      })
    ).toBeNull();
  });

  it('rejects palettes with non-string color values', () => {
    // Act & Assert
    expect(
      parseBrandColors({
        primary: 123,
        background: '#ffffff',
        accent: '#F59E0B',
      })
    ).toBeNull();
  });

  it('rejects undefined input', () => {
    // Act & Assert
    expect(parseBrandColors(undefined)).toBeNull();
  });

  it('rejects non-object inputs', () => {
    // Act & Assert
    expect(parseBrandColors('not-an-object')).toBeNull();
    expect(parseBrandColors([])).toBeNull();
    expect(parseBrandColors(123)).toBeNull();
  });
});
