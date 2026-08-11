import { describe, expect, it } from 'vitest';
import { hasSupportedCardSlotType } from './has-supported-card-slot-type';
import { getKeySpecCategoriesForFamily } from './spec-category-families';

describe('category-specific key spec families', () => {
  it('provides camera NFC without unrelated phone-only network fields', () => {
    const categories = getKeySpecCategoriesForFamily('camera');
    const fields = categories.flatMap((category) => category.fields);

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'main_camera_mp' }),
        expect.objectContaining({ key: 'rear_camera_video' }),
        expect.objectContaining({ key: 'card_slot_type' }),
        expect.objectContaining({ key: 'has_nfc' }),
      ])
    );
    expect(fields).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'has_5g' }),
        expect.objectContaining({ key: 'sim_type' }),
      ])
    );
  });

  it('only displays camera card-slot types when support is explicitly confirmed', () => {
    const cardSlot = getKeySpecCategoriesForFamily('camera')
      .flatMap((category) => category.fields)
      .find((field) => field.key === 'card_slot_type');

    expect(
      cardSlot?.condition?.({
        has_card_slot: true,
        card_slot_type: 'CFexpress Type B',
      })
    ).toBe(true);
    expect(
      cardSlot?.condition?.({
        card_slot_type: 'CFexpress Type B',
        has_card_slot: false,
      })
    ).toBe(false);
  });

  it('fails closed when a card-slot type is missing or non-string', () => {
    expect(hasSupportedCardSlotType({ has_card_slot: true })).toBe(false);
    expect(
      hasSupportedCardSlotType({
        has_card_slot: true,
        card_slot_type: null,
      } as unknown as Parameters<typeof hasSupportedCardSlotType>[0])
    ).toBe(false);
    expect(
      hasSupportedCardSlotType({
        has_card_slot: true,
        card_slot_type: 128,
      } as unknown as Parameters<typeof hasSupportedCardSlotType>[0])
    ).toBe(false);
  });

  it('returns no inferred key spec fields for unclassified accessory categories', () => {
    expect(getKeySpecCategoriesForFamily('general')).toEqual([]);
  });

  it('removes phone camera placeholders from computer fields', () => {
    const fields = getKeySpecCategoriesForFamily('computer').flatMap(
      (category) => category.fields
    );

    expect(fields).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'main_camera_mp' }),
        expect.objectContaining({ key: 'rear_camera_features' }),
        expect.objectContaining({ key: 'rear_camera_video' }),
        expect.objectContaining({ key: 'front_camera_mp' }),
        expect.objectContaining({ key: 'front_camera_features' }),
        expect.objectContaining({ key: 'front_camera_video' }),
      ])
    );
  });

  it('retains legitimate computer audio fields', () => {
    const fields = getKeySpecCategoriesForFamily('computer').flatMap(
      (category) => category.fields
    );

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'has_headphone_jack' }),
        expect.objectContaining({ key: 'has_stereo_speakers' }),
      ])
    );
  });

  it('provides safe general hardware fields only for non-accessory categories', () => {
    const gamingFields = getKeySpecCategoriesForFamily('general', 'Gaming')
      .flatMap((category) => category.fields)
      .map((field) => field.key);

    expect(gamingFields).toEqual(
      expect.arrayContaining(['chipset', 'gpu', 'storage_gb'])
    );
    expect(
      getKeySpecCategoriesForFamily('general', 'PlayStation Accessories')
    ).toEqual([]);
  });
});
