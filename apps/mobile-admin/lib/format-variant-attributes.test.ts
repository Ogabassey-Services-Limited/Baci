import { describe, expect, it } from 'vitest';
import { formatVariantAttributesSummary } from '@/lib/format-variant-attributes';

describe('formatVariantAttributesSummary', () => {
  it('formats legacy param/options arrays without object noise', () => {
    expect(
      formatVariantAttributesSummary([
        { param: 'ram', options: ['12GB'] },
        { param: 'storage', options: ['256GB'] },
      ])
    ).toBe('12GB / 256GB');
  });

  it('formats flat records of variant values', () => {
    expect(
      formatVariantAttributesSummary({
        ram: '8GB',
        storage: '128GB',
        sim_type: 'Dual',
      })
    ).toBe('8GB / 128GB / Dual');
  });

  it('extracts readable values from nested objects', () => {
    expect(
      formatVariantAttributesSummary({
        ram: { value: '12GB' },
        storage: { name: '512GB' },
        color: { label: 'Titanium Gray' },
      })
    ).toBe('12GB / 512GB / Titanium Gray');
  });

  it('returns null when nothing readable is present', () => {
    expect(
      formatVariantAttributesSummary([{ param: 'storage', options: [] }])
    ).toBeNull();
  });
});
