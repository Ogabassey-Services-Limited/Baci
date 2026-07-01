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
    ).toBe('RAM: 6GB · Storage: 256GB · Color: Deep Purple');
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
    ).toBe('16GB / 512GB SSD · Condition: used');
  });

  it('shows condition alone when no variant name or attributes exist', () => {
    expect(
      formatNegotiationItemMeta({ name: 'Widget', condition: 'refurbished' })
    ).toBe('Condition: refurbished');
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

  it('does not repeat a condition that is already present in variant text', () => {
    expect(
      formatNegotiationItemMeta({
        name: 'Dell Latitude 7420',
        variant_name: '16GB / Used',
        condition: 'used',
      })
    ).toBe('16GB / Used');
  });

  it('formats numeric attributes and fallback labels', () => {
    expect(
      formatNegotiationItemMeta({
        name: 'Dell Latitude 7420',
        variant_attributes: {
          refresh_rate: 120,
          batteryHealth: '90%',
        } as unknown as Record<string, string>,
      })
    ).toBe('Battery Health: 90% · Refresh Rate: 120');
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
    ).toBe('Storage: 512GB · Condition: open box');
  });

  it('does not suppress unrelated short metadata values', () => {
    expect(
      formatNegotiationItemMeta({
        name: 'Widget',
        variant_name: 'Used Laptop',
        condition: 'top',
      })
    ).toBe('Used Laptop · Condition: top');
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
