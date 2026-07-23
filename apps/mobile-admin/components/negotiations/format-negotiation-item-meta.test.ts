import { describe, expect, it } from 'vitest';
import { formatNegotiationItemMeta } from './format-negotiation-item-meta';

describe('formatNegotiationItemMeta', () => {
  it('formats selected variant attributes in a merchant-readable order', () => {
    expect(
      formatNegotiationItemMeta({
        name: 'iPhone 14 Pro Max',
        current_price: 875_000,
        variant_attributes: {
          color_hex: '#1C1C1C',
          color: 'Deep Purple',
          storage: '256GB',
          ram: '6GB',
        },
      })
    ).toEqual([
      { label: 'RAM', value: '6GB' },
      { label: 'Storage', value: '256GB' },
      { label: 'Color', value: 'Deep Purple' },
    ]);
  });

  it('uses a saved variant label when one exists and keeps condition visible', () => {
    expect(
      formatNegotiationItemMeta({
        name: 'Dell Latitude 7420',
        variant_name: '16GB / 512GB SSD',
        condition: 'used',
        variant_attributes: {
          ram: '16GB',
          storage: '512GB SSD',
        },
      })
    ).toEqual([
      { label: 'Variant', value: '16GB / 512GB SSD' },
      { label: 'Condition', value: 'used' },
    ]);
  });

  it('keeps attributes the variant label does not already convey', () => {
    expect(
      formatNegotiationItemMeta({
        name: 'iPhone 15 Pro',
        variant_name: 'Silver',
        variant_attributes: {
          color: 'Silver',
          storage: '256GB',
          ram: '16GB',
        },
      })
    ).toEqual([
      { label: 'Variant', value: 'Silver' },
      { label: 'RAM', value: '16GB' },
      { label: 'Storage', value: '256GB' },
    ]);
  });

  it('shows condition alone when no variant name or attributes exist', () => {
    expect(
      formatNegotiationItemMeta({ name: 'Widget', condition: 'refurbished' })
    ).toEqual([{ label: 'Condition', value: 'refurbished' }]);
  });

  it('returns null when all attributes are ignored or invalid', () => {
    expect(
      formatNegotiationItemMeta({
        name: 'Widget',
        variant_attributes: {
          color_hex: '#ffffff',
          id: 'variant-1',
          sku: 'sku-1',
          storage: ' ',
        },
      })
    ).toBeNull();
  });

  it('ignores values that become empty after condition normalization', () => {
    expect(
      formatNegotiationItemMeta({
        name: 'Widget',
        variant_name: 'Condition:',
        variant_attributes: {
          storage: 'Condition:',
        },
      })
    ).toBeNull();
  });

  it('does not repeat a condition that is already present in variant text', () => {
    expect(
      formatNegotiationItemMeta({
        name: 'Dell Latitude 7420',
        variant_name: '16GB / Used',
        condition: 'used',
      })
    ).toEqual([{ label: 'Variant', value: '16GB / Used' }]);
  });

  it('formats numeric attributes and fallback labels', () => {
    expect(
      formatNegotiationItemMeta({
        name: 'Dell Latitude 7420',
        variant_attributes: {
          refresh_rate: 120,
          batteryHealth: '90%',
          sim_type: 'Dual SIM',
        } as unknown as Record<string, string>,
      })
    ).toEqual([
      { label: 'Battery Health', value: '90%' },
      { label: 'Refresh Rate', value: '120' },
      { label: 'SIM type', value: 'Dual SIM' },
    ]);
  });

  it('uses item condition instead of condition duplicated in attributes', () => {
    expect(
      formatNegotiationItemMeta({
        name: 'Dell Latitude 7420',
        condition: 'open_box',
        variant_attributes: {
          condition: 'used',
          storage: '512GB',
        },
      })
    ).toEqual([
      { label: 'Storage', value: '512GB' },
      { label: 'Condition', value: 'open box' },
    ]);
  });

  it('does not suppress unrelated short metadata values', () => {
    expect(
      formatNegotiationItemMeta({
        name: 'Widget',
        variant_name: 'Used Laptop',
        condition: 'top',
      })
    ).toEqual([
      { label: 'Variant', value: 'Used Laptop' },
      { label: 'Condition', value: 'top' },
    ]);
  });

  it('preserves delimiters inside an attribute value', () => {
    expect(
      formatNegotiationItemMeta({
        name: 'T-shirt',
        variant_attributes: { size: 'Small · Medium' },
      })
    ).toEqual([{ label: 'Size', value: 'Small · Medium' }]);
  });

  it('returns null for null item info', () => {
    expect(formatNegotiationItemMeta(null)).toBeNull();
  });

  it('returns null when variant attributes are present but empty', () => {
    expect(
      formatNegotiationItemMeta({ name: 'Widget', variant_attributes: {} })
    ).toBeNull();
  });

  it('returns null when no variant details were persisted', () => {
    expect(
      formatNegotiationItemMeta({ name: 'Wireless Headphones' })
    ).toBeNull();
  });
});
