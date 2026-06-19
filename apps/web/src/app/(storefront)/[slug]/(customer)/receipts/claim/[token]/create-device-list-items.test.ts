import { describe, expect, it } from 'vitest';
import { createDeviceListItems } from './create-device-list-items';

describe('createDeviceListItems', () => {
  it('creates duplicate-safe device item keys', () => {
    expect(createDeviceListItems(['Pixel 9', 'Pixel 9'])).toEqual([
      { device: 'Pixel 9', key: 'Pixel 9-1' },
      { device: 'Pixel 9', key: 'Pixel 9-2' },
    ]);
  });
});
