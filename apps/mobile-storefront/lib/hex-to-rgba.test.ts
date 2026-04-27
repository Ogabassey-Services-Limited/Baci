import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { hexToRgba } from './hex-to-rgba';

describe('hexToRgba', () => {
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

  afterEach(() => {
    warnSpy.mockClear();
  });

  it('converts a valid 6-digit hex with full alpha', () => {
    expect(hexToRgba('#1a2b3c', 1)).toBe('rgba(26,43,60,1)');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('expands and converts a valid 3-digit hex', () => {
    expect(hexToRgba('#abc', 0.5)).toBe('rgba(170,187,204,0.5)');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns transparent fallback and warns on invalid hex', () => {
    expect(hexToRgba('not-a-color', 0.5)).toBe('rgba(0,0,0,0)');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('invalid hex color received')
    );
  });

  it('clamps and warns when alpha is out of range', () => {
    expect(hexToRgba('#000000', 2)).toBe('rgba(0,0,0,1)');
    expect(hexToRgba('#000000', -0.5)).toBe('rgba(0,0,0,0)');
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('alpha out of range')
    );
  });

  it('defaults to 1 and warns when alpha is non-finite', () => {
    expect(hexToRgba('#000000', Number.NaN)).toBe('rgba(0,0,0,1)');
    expect(hexToRgba('#000000', Number.POSITIVE_INFINITY)).toBe(
      'rgba(0,0,0,1)'
    );
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('non-finite alpha received')
    );
  });
});
