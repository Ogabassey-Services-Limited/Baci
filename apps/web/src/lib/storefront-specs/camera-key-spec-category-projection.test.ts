import { describe, expect, it } from 'vitest';
import { getCameraKeySpecCategoryProjection } from './camera-key-spec-category-projection';

describe('getCameraKeySpecCategoryProjection', () => {
  it('exposes verified camera capabilities without mobile network fields', () => {
    const fields = getCameraKeySpecCategoryProjection().flatMap(
      (category) => category.fields
    );

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'main_camera_mp' }),
        expect.objectContaining({ key: 'has_ois' }),
        expect.objectContaining({ key: 'has_nfc' }),
        expect.objectContaining({ key: 'positioning' }),
        expect.objectContaining({ key: 'card_slot_type' }),
      ])
    );
    expect(fields).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'has_5g' }),
        expect.objectContaining({ key: 'sim_type' }),
      ])
    );
  });
});
