import { jest } from '@jest/globals';
import {
  DEFAULT_FALLBACK_VAT_RATE_PERCENT,
  FALLBACK_VAT_RATE_ENV,
  resolveFallbackVatRate,
} from './tax';

describe('resolveFallbackVatRate', () => {
  const originalValue = process.env[FALLBACK_VAT_RATE_ENV];
  let warnSpy: ReturnType<typeof jest.spyOn>;

  function setFallbackVatRate(value?: string) {
    if (value === undefined) {
      delete process.env[FALLBACK_VAT_RATE_ENV];
    } else {
      process.env[FALLBACK_VAT_RATE_ENV] = value;
    }
  }

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    setFallbackVatRate(undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    if (originalValue === undefined) {
      delete process.env[FALLBACK_VAT_RATE_ENV];
    } else {
      process.env[FALLBACK_VAT_RATE_ENV] = originalValue;
    }
  });

  it('uses the Nigerian fallback VAT rate when no env override is configured', () => {
    expect(resolveFallbackVatRate()).toBe(DEFAULT_FALLBACK_VAT_RATE_PERCENT);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('uses the Nigerian fallback VAT rate when the env override is empty', () => {
    setFallbackVatRate('   ');

    expect(resolveFallbackVatRate()).toBe(DEFAULT_FALLBACK_VAT_RATE_PERCENT);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('accepts a configured positive rate', () => {
    setFallbackVatRate('10');

    expect(resolveFallbackVatRate()).toBe(10);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('accepts zero for tax-exempt jurisdictions', () => {
    setFallbackVatRate('0');

    expect(resolveFallbackVatRate()).toBe(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['NaN', 'non-finite'],
    ['Infinity', 'non-finite'],
    ['-1', 'negative'],
  ])('warns and falls back for invalid env value %s', (value, reason) => {
    setFallbackVatRate(value);

    expect(resolveFallbackVatRate()).toBe(DEFAULT_FALLBACK_VAT_RATE_PERCENT);
    expect(warnSpy).toHaveBeenCalledWith(
      `[Tax] Ignoring invalid ${FALLBACK_VAT_RATE_ENV}: ${reason}`,
      { value }
    );
  });
});
