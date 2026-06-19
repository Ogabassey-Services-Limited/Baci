import { describe, expect, it } from 'vitest';
import { createDeviceListItems } from './create-device-list-items';

describe('createDeviceListItems', () => {
  it('creates duplicate-safe device item keys', () => {
    expect(createDeviceListItems(['Pixel 9', 'Pixel 9'])).toEqual([
      { device: 'Pixel 9', key: 'Pixel 9-1' },
      { device: 'Pixel 9', key: 'Pixel 9-2' },
    ]);
  });

  it('returns an empty list for empty input', () => {
    expect(createDeviceListItems([])).toEqual([]);
  });

  it('keeps occurrence numbering per device in mixed order', () => {
    expect(
      createDeviceListItems(['Pixel 9', 'iPhone 16', 'Pixel 9', 'iPhone 16'])
    ).toEqual([
      { device: 'Pixel 9', key: 'Pixel 9-1' },
      { device: 'iPhone 16', key: 'iPhone 16-1' },
      { device: 'Pixel 9', key: 'Pixel 9-2' },
      { device: 'iPhone 16', key: 'iPhone 16-2' },
    ]);
  });
});
