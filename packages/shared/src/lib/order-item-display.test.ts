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

  it('dedupes condition labels from any comma segment', () => {
    expect(
      formatOrderItemOptionLabel({
        condition: 'used',
        variantName: 'Used, 512GB',
      })
    ).toBe('Used / 512GB');

    expect(
      formatOrderItemOptionLabel({
        condition: 'used',
        variantName: 'Blue, Used, 512GB',
      })
    ).toBe('Used / Blue, 512GB');
  });

  it('dedupes condition labels embedded as standalone variant words', () => {
    expect(
      formatOrderItemOptionLabel({
        condition: 'used',
        variantName: '128GB WiFi Used',
      })
    ).toBe('Used / 128GB WiFi');

    expect(
      formatOrderItemDisplayName({
        baseName: 'iPad Pro',
        condition: 'used',
        variantName: '128GB WiFi Used',
      })
    ).toBe('iPad Pro (Used / 128GB WiFi)');
  });

  it('does not strip condition text from unrelated variant words', () => {
    expect(
      formatOrderItemOptionLabel({
        condition: 'new',
        variantName: 'Renewed Blue',
      })
    ).toBe('New / Renewed Blue');
  });

  it('preserves commas inside variant values', () => {
    expect(
      formatOrderItemOptionLabel({
        condition: 'open_box',
        variantName: 'Blue / 5,000mAh',
      })
    ).toBe('Open Box / Blue / 5,000mAh');
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

  it('does not duplicate condition labels already present in the item name', () => {
    expect(
      formatOrderItemDisplayName({
        baseName: 'Samsung Galaxy Fold 5 (Premium Used)',
        condition: 'used',
      })
    ).toBe('Samsung Galaxy Fold 5 (Premium Used)');
  });

  it('keeps condition metadata when the condition token is part of the product name', () => {
    expect(
      formatOrderItemDisplayName({
        baseName: 'New Balance 574',
        condition: 'new',
      })
    ).toBe('New Balance 574 (New)');
  });

  it('does not duplicate leading condition segments in the item name', () => {
    expect(
      formatOrderItemDisplayName({
        baseName: 'Used, iPhone 12',
        condition: 'used',
      })
    ).toBe('Used, iPhone 12');
  });

  it('does not duplicate exact condition-only item names', () => {
    expect(
      formatOrderItemDisplayName({
        baseName: 'Used',
        condition: 'used',
      })
    ).toBe('Used');
  });

  it('still shows variant labels when the item name already has the condition', () => {
    expect(
      formatOrderItemDisplayName({
        baseName: 'Samsung Galaxy Fold 5 (Premium Used)',
        condition: 'used',
        variantName: '512GB, Used',
      })
    ).toBe('Samsung Galaxy Fold 5 (Premium Used) (512GB)');
  });

  it('dedupes non-trailing variant condition labels when the item name already has the condition', () => {
    expect(
      formatOrderItemDisplayName({
        baseName: 'Samsung Galaxy Fold 5 (Premium Used)',
        condition: 'used',
        variantName: 'Used, 512GB',
      })
    ).toBe('Samsung Galaxy Fold 5 (Premium Used) (512GB)');
  });
});
