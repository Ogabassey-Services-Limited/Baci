import { formatUtilityAmountInput } from '@/components/utilities/utility-amount-format';

describe('formatUtilityAmountInput', () => {
  it('formats amount input with thousands separators', () => {
    expect(formatUtilityAmountInput('1000')).toBe('1,000');
    expect(formatUtilityAmountInput(250000)).toBe('250,000');
    expect(formatUtilityAmountInput(1_000_000_000)).toBe('1,000,000,000');
  });

  it('formats decimal, negative, and already formatted amount input consistently', () => {
    expect(formatUtilityAmountInput('1000.50')).toBe('1,000.5');
    expect(formatUtilityAmountInput('1234.56')).toBe('1,234.56');
    expect(formatUtilityAmountInput(1000.5)).toBe('1,000.5');
    expect(formatUtilityAmountInput(-1000)).toBe('-1,000');
    expect(formatUtilityAmountInput('1,000')).toBe('1,000');
  });

  it('formats mixed whitespace and comma input consistently', () => {
    expect(formatUtilityAmountInput(' 1,234.50 ')).toBe('1,234.5');
    expect(formatUtilityAmountInput('\t2,500\n')).toBe('2,500');
  });

  it('formats zero explicitly and returns empty string for unset input', () => {
    expect(formatUtilityAmountInput('')).toBe('');
    expect(formatUtilityAmountInput(0)).toBe('0');
    expect(formatUtilityAmountInput('abc')).toBe('');
    expect(formatUtilityAmountInput(null as unknown as string)).toBe('');
    expect(formatUtilityAmountInput(undefined as unknown as string)).toBe('');
  });

  it('returns empty string for NaN and infinite input', () => {
    expect(formatUtilityAmountInput(Number.NaN)).toBe('');
    expect(formatUtilityAmountInput(Number.POSITIVE_INFINITY)).toBe('');
    expect(formatUtilityAmountInput(Number.NEGATIVE_INFINITY)).toBe('');
    expect(formatUtilityAmountInput('NaN')).toBe('');
    expect(formatUtilityAmountInput('Infinity')).toBe('');
    expect(formatUtilityAmountInput('+Infinity')).toBe('');
    expect(formatUtilityAmountInput('-Infinity')).toBe('');
  });

  it('normalizes scientific notation input', () => {
    expect(formatUtilityAmountInput('1e6')).toBe('1,000,000');
    expect(formatUtilityAmountInput('2.5e3')).toBe('2,500');
    expect(formatUtilityAmountInput('-1e3')).toBe('-1,000');
    expect(formatUtilityAmountInput('-2.5e3')).toBe('-2,500');
    expect(formatUtilityAmountInput('1e-3')).toBe('0');
    expect(formatUtilityAmountInput('-2.5e-3')).toBe('-0');
  });

  it('normalizes decimal edge cases', () => {
    expect(formatUtilityAmountInput('.5')).toBe('0.5');
    expect(formatUtilityAmountInput('5.')).toBe('5');
    expect(formatUtilityAmountInput('1.2.3')).toBe('');
  });

  it('trims leading zeros', () => {
    expect(formatUtilityAmountInput('007')).toBe('7');
    expect(formatUtilityAmountInput('0123')).toBe('123');
  });

  it('accepts an explicit locale for display formatting', () => {
    expect(formatUtilityAmountInput('1234.5', 'de-DE')).toBe('1.234,5');
    expect(formatUtilityAmountInput('1.234,56', 'de-DE')).toBe('1.234,56');
    expect(formatUtilityAmountInput('1,5', 'de-DE')).toBe('1,5');
  });

  it('returns empty string for English-formatted input when locale is de-DE', () => {
    expect(formatUtilityAmountInput('1,234.5', 'de-DE')).toBe('');
  });

  it('formats input when the runtime does not support formatToParts', () => {
    const originalFormatToParts = Intl.NumberFormat.prototype.formatToParts;
    Object.defineProperty(Intl.NumberFormat.prototype, 'formatToParts', {
      configurable: true,
      value: undefined,
    });

    try {
      expect(formatUtilityAmountInput('1000')).toBe('1,000');
      expect(formatUtilityAmountInput('1,000')).toBe('1,000');
      expect(formatUtilityAmountInput('1234.5', 'de-DE')).toBe('1.234,5');
      expect(formatUtilityAmountInput('1.234,56', 'de-DE')).toBe('1.234,56');
      expect(formatUtilityAmountInput('1234.5', 'ja-JP')).toBe('1,234.5');
      expect(formatUtilityAmountInput('1234.5', 'zh-CN')).toBe('1,234.5');
      // Space-group locales: Intl uses non-breaking space as group separator.
      // The fallback map must treat these as space-group, not dot-group.
      expect(formatUtilityAmountInput('1234,5', 'fi-FI')).toBe(
        new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 }).format(
          1234.5
        )
      );
      expect(formatUtilityAmountInput('1 234,56', 'fr-FR')).toBe(
        new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(
          1234.56
        )
      );
      expect(formatUtilityAmountInput('1 234,56', 'ru-RU')).toBe(
        new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(
          1234.56
        )
      );
      // Czech, Polish, Slovak, Hungarian, Norwegian, Portuguese, Ukrainian
      // also use non-breaking space as group separator under Intl.
      const expectFor = (loc: string, value: number) =>
        new Intl.NumberFormat(loc, { maximumFractionDigits: 2 }).format(value);
      expect(formatUtilityAmountInput('1 234,56', 'cs-CZ')).toBe(
        expectFor('cs-CZ', 1234.56)
      );
      expect(formatUtilityAmountInput('1 234,56', 'pl-PL')).toBe(
        expectFor('pl-PL', 1234.56)
      );
      expect(formatUtilityAmountInput('1 234,56', 'sk-SK')).toBe(
        expectFor('sk-SK', 1234.56)
      );
      expect(formatUtilityAmountInput('1 234,56', 'hu-HU')).toBe(
        expectFor('hu-HU', 1234.56)
      );
      expect(formatUtilityAmountInput('1 234,56', 'no-NO')).toBe(
        expectFor('no-NO', 1234.56)
      );
      expect(formatUtilityAmountInput('1 234,56', 'pt-PT')).toBe(
        expectFor('pt-PT', 1234.56)
      );
      expect(formatUtilityAmountInput('1 234,56', 'uk-UA')).toBe(
        expectFor('uk-UA', 1234.56)
      );
      // Swiss region-specific overrides: de-CH and it-CH use apostrophe
      // grouping under Intl, which the language-only key cannot capture.
      expect(formatUtilityAmountInput('1’234.56', 'de-CH')).toBe(
        expectFor('de-CH', 1234.56)
      );
      expect(formatUtilityAmountInput('1’234.56', 'it-CH')).toBe(
        expectFor('it-CH', 1234.56)
      );
      // Region-specific overrides for diverging variants.
      // pt-BR uses dot grouping (unlike pt-PT NBSP).
      expect(formatUtilityAmountInput('1.234,56', 'pt-BR')).toBe(
        expectFor('pt-BR', 1234.56)
      );
      // de-AT uses NBSP grouping (unlike de-DE dot).
      expect(formatUtilityAmountInput('1 234,56', 'de-AT')).toBe(
        expectFor('de-AT', 1234.56)
      );
      // es-MX uses dot decimal / comma group (unlike es-ES).
      expect(formatUtilityAmountInput('1,234.56', 'es-MX')).toBe(
        expectFor('es-MX', 1234.56)
      );
      // BCP-47 unicode extension subtags should be stripped before
      // region lookup so de-CH-u-nu-latn still hits the apostrophe override.
      expect(
        formatUtilityAmountInput('1’234.56', 'de-CH-u-nu-latn')
      ).toBe(expectFor('de-CH', 1234.56));
      // Unmapped comma-decimal locales (id-ID, vi-VN) must default to
      // comma-decimal/dot-group instead of regressing to dot-decimal.
      expect(formatUtilityAmountInput('1.234,56', 'id-ID')).toBe(
        expectFor('id-ID', 1234.56)
      );
      expect(formatUtilityAmountInput('1.234,56', 'vi-VN')).toBe(
        expectFor('vi-VN', 1234.56)
      );
      // Unmapped dot-decimal locales (hi-IN) must keep dot-decimal.
      expect(formatUtilityAmountInput('1,234.56', 'hi-IN')).toBe(
        expectFor('hi-IN', 1234.56)
      );
    } finally {
      Object.defineProperty(Intl.NumberFormat.prototype, 'formatToParts', {
        configurable: true,
        value: originalFormatToParts,
      });
    }
  });
});
