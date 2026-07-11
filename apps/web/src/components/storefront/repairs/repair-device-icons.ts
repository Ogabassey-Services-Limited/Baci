import {
  Gamepad2,
  HelpCircle,
  Laptop,
  type LucideIcon,
  Smartphone,
  Tablet,
  Watch,
} from 'lucide-react';

/**
 * Maps `repair_devices.device_type` values to a display icon. Shared between
 * the device picker cards and the device detail page header so device-type
 * iconography stays consistent across the repairs catalogue.
 */
export const REPAIR_DEVICE_TYPE_ICONS: Record<string, LucideIcon> = {
  Console: Gamepad2,
  Laptop,
  Other: HelpCircle,
  Smartphone,
  Smartwatch: Watch,
  Tablet,
};

export const REPAIR_DEVICE_FALLBACK_ICON: LucideIcon = HelpCircle;
