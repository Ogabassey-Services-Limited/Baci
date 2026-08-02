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
});
