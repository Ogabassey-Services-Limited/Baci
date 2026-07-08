import { describe, expect, it } from 'vitest';
import {
  formatOrderItemDisplayName,
  formatOrderItemOptionLabel,
} from './order-item-display';

describe('order item display helpers', () => {
  it('combines condition and variant labels with the condition first', () => {
    expect(
      formatOrderItemOptionLabel({
        condition: 'open_box',
        variantName: '512GB',
      })
    ).toBe('Open Box / 512GB');
  });

  it('does not duplicate equivalent condition labels already in the variant name', () => {
    expect(
      formatOrderItemOptionLabel({
        condition: 'open_box',
        variantName: 'Open Box / 512GB',
      })
    ).toBe('Open Box / 512GB');
  });

  it('dedupes condition labels from comma-separated variant names', () => {
    expect(
      formatOrderItemOptionLabel({
        condition: 'open_box',
        variantName: 'Blue / 128GB, Open Box',
      })
    ).toBe('Open Box / Blue / 128GB');
  });

  it('returns a display name with option metadata when present', () => {
    expect(
      formatOrderItemDisplayName({
        baseName: '13" MacBook Air M2 (2022)',
        condition: 'open_box',
        variantName: '512GB',
      })
    ).toBe('13" MacBook Air M2 (2022) (Open Box / 512GB)');
  });
});
