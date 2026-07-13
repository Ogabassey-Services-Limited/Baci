import { describe, expect, it } from 'vitest';
import { IMEI_DEVICE_CATEGORIES } from '@baci/shared/imei';
import { IMEI_DEVICE_ICONS } from './imei-checker-device-icons';

describe('IMEI_DEVICE_ICONS', () => {
  it('maps every device category to an icon component', () => {
    for (const category of IMEI_DEVICE_CATEGORIES) {
      expect(IMEI_DEVICE_ICONS[category.id]).toBeDefined();
    }
  });
});
