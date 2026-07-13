import {
  BadgeCheck,
  Barcode,
  Briefcase,
  Cloud,
  Globe,
  Hammer,
  Info,
  Laptop,
  Lock,
  MapPin,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Tag,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { ImeiServiceTierKey } from '@baci/shared/imei';

/** Default icon for any catalog key not explicitly mapped below (defensive). */
export const DEFAULT_TIER_ICON: LucideIcon = BadgeCheck;

/**
 * Web-specific lucide-react icon per tier key. The shared package's per-tier
 * `icon` field holds Ionicons names for the mobile app, so web needs its own
 * mapping to cover the full 29-key catalog (not just the legacy primary 4).
 */
export const IMEI_TIER_ICONS: Partial<Record<ImeiServiceTierKey, LucideIcon>> =
  {
    // Core
    full: BadgeCheck,
    blacklist: ShieldAlert,
    blacklistPro: ShieldAlert,
    carrier: Globe,
    simLock: Lock,
    icloud: Cloud,
    carrierFmi: Info,
    basic: Info,
    // Apple (spans multiple device categories)
    activation: Sparkles,
    icloudPro: Cloud,
    appleBasic: BadgeCheck,
    demoUnit: Store,
    mdm: Briefcase,
    // Apple device (serial-input)
    serialInfo: Barcode,
    icloudCleanLost: Cloud,
    macIcloud: Laptop,
    soldByCountry: MapPin,
    gsxPremium: Sparkles,
    gsxRepairs: Wrench,
    repairEligibility: Wrench,
    replacementHistory: RefreshCw,
    // Android
    samsung: Smartphone,
    samsungPro: Smartphone,
    knoxGuard: Lock,
    miLock: Lock,
    miLostPro: Shield,
    pixel: Smartphone,
    oppoRealme: Smartphone,
    transsion: Smartphone,
  };

export function getTierIcon(tierKey: ImeiServiceTierKey): LucideIcon {
  return IMEI_TIER_ICONS[tierKey] ?? DEFAULT_TIER_ICON;
}
