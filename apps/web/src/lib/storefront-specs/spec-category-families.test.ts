import { describe, expect, it } from 'vitest';
import { getKeySpecCategoriesForFamily } from './spec-category-families';

describe('category-specific key spec families', () => {
  it('provides camera fields without phone-only network fields', () => {
    const categories = getKeySpecCategoriesForFamily('camera');
    const fields = categories.flatMap((category) => category.fields);

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'main_camera_mp' }),
        expect.objectContaining({ key: 'rear_camera_video' }),
        expect.objectContaining({ key: 'card_slot_type' }),
      ])
    );
    expect(fields).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'has_5g' }),
        expect.objectContaining({ key: 'has_nfc' }),
        expect.objectContaining({ key: 'sim_type' }),
      ])
    );
  });

  it('returns no inferred key spec fields for unclassified accessory categories', () => {
    expect(getKeySpecCategoriesForFamily('general')).toEqual([]);
  });
});
