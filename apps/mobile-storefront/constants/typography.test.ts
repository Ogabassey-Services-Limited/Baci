import { afterEach, describe, expect, it, jest } from '@jest/globals';

function loadTypographyForWidth(width: number) {
  jest.resetModules();
  jest.doMock('react-native', () => ({
    Dimensions: {
      get: jest.fn(() => ({ width })),
    },
  }));

  return require('./typography') as typeof import('./typography');
}

describe('typography clamp', () => {
  afterEach(() => {
    jest.dontMock('react-native');
    jest.resetModules();
  });

  it('returns the minimum when scaled size is below the minimum', () => {
    const { clamp, SCREEN_WIDTH } = loadTypographyForWidth(320);

    expect(SCREEN_WIDTH).toBe(320);
    expect(clamp(10, 12)).toBe(10);
  });

  it('returns the maximum when scaled size is above the maximum', () => {
    const { clamp, SCREEN_WIDTH } = loadTypographyForWidth(600);

    expect(SCREEN_WIDTH).toBe(600);
    expect(clamp(10, 12)).toBe(12);
  });

  it('returns the scaled value when it equals the minimum', () => {
    const { clamp, SCREEN_WIDTH } = loadTypographyForWidth(375);

    expect(SCREEN_WIDTH).toBe(375);
    expect(clamp(10, 12)).toBe(10);
  });

  it('returns the scaled value between the minimum and maximum', () => {
    const { clamp, SCREEN_WIDTH } = loadTypographyForWidth(450);

    expect(SCREEN_WIDTH).toBe(450);
    expect(clamp(10, 20)).toBe(12);
  });

  it('supports a custom base width', () => {
    const { clamp, SCREEN_WIDTH } = loadTypographyForWidth(500);

    expect(SCREEN_WIDTH).toBe(500);
    expect(clamp(8, 20, 250)).toBe(16);
  });
});
