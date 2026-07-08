import { describe, expect, it } from 'vitest';
import {
  REPAIR_DEVICE_FALLBACK_ICON,
  REPAIR_DEVICE_TYPE_ICONS,
} from './repair-device-icons';

const KNOWN_DEVICE_TYPES = [
  'Smartphone',
  'Laptop',
  'Tablet',
  'Console',
  'Smartwatch',
  'Other',
];

describe('REPAIR_DEVICE_TYPE_ICONS', () => {
  it('maps every known repair_devices.device_type value to an icon', () => {
    for (const deviceType of KNOWN_DEVICE_TYPES) {
      expect(REPAIR_DEVICE_TYPE_ICONS[deviceType]).toBeDefined();
    }
  });

  it('exposes a fallback icon for unrecognized device types', () => {
    expect(REPAIR_DEVICE_FALLBACK_ICON).toBeDefined();
    expect(REPAIR_DEVICE_TYPE_ICONS.NotARealType).toBeUndefined();
  });
});
