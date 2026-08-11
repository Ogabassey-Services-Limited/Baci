import { describe, expect, it } from 'vitest';

import { shouldIncludeProductSchemaSpec } from './product-schema-specs';

describe('shouldIncludeProductSchemaSpec camera policies', () => {
  it('applies the camera key allowlist and rejects card-slot placeholders', () => {
    expect(
      shouldIncludeProductSchemaSpec(
        { category: 'Cameras', categories: null },
        { key: 'network_technology', value: 'N/A' }
      )
    ).toBe(false);
    expect(
      shouldIncludeProductSchemaSpec(
        { category: 'Cameras', categories: null },
        { label: 'Network Technology', value: 'N/A' }
      )
    ).toBe(false);
    expect(
      shouldIncludeProductSchemaSpec(
        { category: 'Cameras', categories: null },
        { label: 'Selfie Camera', value: '0MP' }
      )
    ).toBe(false);
    expect(
      shouldIncludeProductSchemaSpec(
        { category: 'Cameras', categories: null },
        { key: 'front_camera_mp', value: 0 }
      )
    ).toBe(false);

    for (const value of ['N/A', 'None', 'Not supported']) {
      expect(
        shouldIncludeProductSchemaSpec(
          { category: 'Cameras', categories: null },
          { key: 'card_slot_type', value }
        )
      ).toBe(false);
    }
  });

  it('retains verified cellular network technology for computers', () => {
    expect(
      shouldIncludeProductSchemaSpec(
        { category: 'Laptops', categories: null },
        { key: 'network_technology', value: '5G NR' }
      )
    ).toBe(true);
  });
});
