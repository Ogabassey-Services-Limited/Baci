import { describe, expect, it } from 'vitest';
import { buildDetailedSpecsFromKeySpecs } from './spec-key-specs';

describe('buildDetailedSpecsFromKeySpecs', () => {
  it('uses the camera taxonomy without phone-only sections', () => {
    const sections = buildDetailedSpecsFromKeySpecs(
      {
        main_camera_mp: 20,
        has_5g: false,
      },
      'camera'
    );

    expect(sections).toEqual([
      {
        category: 'Imaging',
        items: [{ label: 'Effective Resolution', value: '20MP' }],
      },
    ]);
  });

  it('omits unsupported general values while retaining safe console hardware specs', () => {
    const sections = buildDetailedSpecsFromKeySpecs(
      {
        chipset: 'AMD Zen 2',
        gpu: 'RDNA 2',
        storage_gb: 825,
        battery_mah: 0,
      },
      'general',
      'Gaming'
    );

    expect(sections).toEqual(
      expect.arrayContaining([
        {
          category: 'Processing',
          items: [
            { label: 'Processor', value: 'AMD Zen 2' },
            { label: 'GPU', value: 'RDNA 2' },
          ],
        },
        {
          category: 'Memory',
          items: [{ label: 'Internal Storage', value: '825GB' }],
        },
      ])
    );
    expect(sections.flatMap((section) => section.items)).not.toEqual(
      expect.arrayContaining([{ label: 'Capacity', value: '0mAh' }])
    );
  });

  it('omits camera card-slot placeholders from the camera projection', () => {
    const sections = buildDetailedSpecsFromKeySpecs(
      { card_slot_type: 'N/A', storage_gb: 8 },
      'camera'
    );

    expect(sections).toEqual([
      {
        category: 'Storage',
        items: [{ label: 'Internal Storage', value: '8GB' }],
      },
    ]);
  });
});
