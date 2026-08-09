import { describe, expect, it } from 'vitest';
import { hasSupportedCardSlotType } from './has-supported-card-slot-type';

describe('hasSupportedCardSlotType', () => {
  it('fails closed for missing, non-string, placeholder, or disabled card slots', () => {
    expect(hasSupportedCardSlotType({ has_card_slot: true })).toBe(false);
    expect(
      hasSupportedCardSlotType({ has_card_slot: true, card_slot_type: 'N/A' })
    ).toBe(false);
    expect(
      hasSupportedCardSlotType({
        has_card_slot: true,
        card_slot_type: 128,
      } as unknown as Parameters<typeof hasSupportedCardSlotType>[0])
    ).toBe(false);
    expect(
      hasSupportedCardSlotType({
        has_card_slot: false,
        card_slot_type: 'CFexpress Type B',
      })
    ).toBe(false);
  });

  it('accepts a present supported card-slot type', () => {
    expect(
      hasSupportedCardSlotType({ card_slot_type: 'CFexpress Type B' })
    ).toBe(true);
  });
});
