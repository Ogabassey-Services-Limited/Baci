import { Laptop, Smartphone, Tablet, Watch, type LucideIcon } from 'lucide-react';
import type { ImeiDeviceCategory } from '@baci/shared/imei';

/**
 * Web-specific lucide-react icon per device category. The shared package's
 * IMEI_DEVICE_CATEGORIES.icon field holds Ionicons names for the mobile app —
 * web needs its own mapping rather than reusing that field directly.
 */
export const IMEI_DEVICE_ICONS = {
  smartphone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  watch: Watch,
} as const satisfies Record<ImeiDeviceCategory, LucideIcon>;
