import { describe, expect, it } from 'vitest';
import { buildProductContextSpecFacts } from './build-product-context-spec-facts';

describe('buildProductContextSpecFacts', () => {
  it('keeps scalar device facts while excluding relation metadata', () => {
    expect(
      buildProductContextSpecFacts(
        {
          created_at: '2026-06-01T00:00:00Z',
          ram_gb: 8,
          storage_gb: 256,
          has_5g: true,
        },
        'Smartphones'
      )
    ).toEqual(['RAM: 8GB', 'Internal Storage: 256GB', '5G Support: Yes']);
  });

  it('filters unsupported generic facts but preserves safe gaming details', () => {
    expect(
      buildProductContextSpecFacts(
        {
          storage_gb: 0,
          chipset: 'AMD Ryzen 7',
          gpu: 'RTX 4060',
          platform: 'PlayStation 5',
        },
        'PlayStation 5'
      )
    ).toEqual([
      'Processor: AMD Ryzen 7',
      'GPU: RTX 4060',
      'platform: PlayStation 5',
    ]);
  });
});
