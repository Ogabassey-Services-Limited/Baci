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
          camera_score: 88,
          battery_score: 91,
          gaming_score: 95,
          has_dual_camera: true,
        },
        'PlayStation 5'
      )
    ).toEqual([
      'Processor: AMD Ryzen 7',
      'GPU: RTX 4060',
      'Platform: PlayStation 5',
    ]);
  });

  it('filters invalid mobile and computer measurement facts', () => {
    expect(
      buildProductContextSpecFacts(
        { storage_gb: 0, display_resolution: 'N/A', has_5g: false },
        'Smartphones'
      )
    ).toEqual(['5G Support: No']);
    expect(
      buildProductContextSpecFacts(
        { ram_gb: 0, display_resolution: 'N/A', chipset: 'Apple M4' },
        'Laptops'
      )
    ).toEqual(['Chipset: Apple M4']);
  });

  it('uses mobile facts for a slug-only google-pixel context category', () => {
    expect(
      buildProductContextSpecFacts({ has_5g: true, ram_gb: 12 }, 'google-pixel')
    ).toEqual(['5G Support: Yes', 'RAM: 12GB']);
  });

  it('retains verified NFC in camera context facts', () => {
    expect(
      buildProductContextSpecFacts({ has_nfc: true }, 'Action Cameras')
    ).toEqual(['NFC: Yes']);
  });
});
