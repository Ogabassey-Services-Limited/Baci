import { describe, expect, it } from 'vitest';
import { buildFeedDescription } from './build-feed-description';

describe('buildFeedDescription', () => {
  it('appends the key phone specs Merchant Center flagged as missing', () => {
    const description = buildFeedDescription({
      name: 'iPhone 17 Pro Max',
      description: '<p>Flagship iPhone with fast performance.</p>',
      color: 'Black Titanium',
      product_key_specs: {
        screen_size_inches: 6.9,
        display_resolution: '1320 x 2868',
        ram_gb: 12,
        storage_gb: 256,
        main_camera_mp: 48,
        front_camera_mp: 12,
        weight_g: 227,
      },
    });

    expect(description).toContain('Flagship iPhone with fast performance.');
    expect(description).toContain('Colour: Black Titanium');
    expect(description).toContain('Screen size: 6.9 inches');
    expect(description).toContain('Screen resolution: 1320 x 2868');
    expect(description).toContain('RAM: 12GB');
    expect(description).toContain('Storage capacity: 256GB');
    expect(description).toContain('Rear camera resolution: 48MP');
    expect(description).toContain('Front camera resolution: 12MP');
    expect(description).toContain('Weight: 227g');
  });

  it('falls back to the product name when no base description exists', () => {
    const description = buildFeedDescription({
      name: 'Galaxy S26',
      description: '',
      product_key_specs: {
        ram_gb: 8,
      },
    });

    expect(description).toBe('Galaxy S26. Key details: RAM: 8GB.');
  });

  it('does not append duplicate detail strings already present in the base description', () => {
    const description = buildFeedDescription({
      name: 'Pixel Ultra',
      description:
        'Pixel Ultra with Colour: Black and RAM: 16GB for demanding workflows.',
      color: 'Black',
      product_key_specs: {
        ram_gb: 16,
      },
    });

    expect(description).toBe(
      'Pixel Ultra with Colour: Black and RAM: 16GB for demanding workflows.'
    );
  });
});
