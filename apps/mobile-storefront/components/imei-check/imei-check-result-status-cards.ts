import type { Ionicons } from '@expo/vector-icons';
import type { ImeiResult } from '@/lib/validation';
import type { ImeiCheckerColors } from './imei-check.types';

export interface ImeiResultStatusCard {
  cleanAware?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint?: string;
  value: string;
}

export function getImeiResultStatusCards(
  result: ImeiResult,
  colors: ImeiCheckerColors
): ImeiResultStatusCard[] {
  return [
    {
      cleanAware: true,
      icon: 'shield-checkmark',
      label: 'Blacklist Status',
      value: result.blacklistStatus,
    },
    optionalStatusCard(result.activationStatus, {
      icon: 'sparkles',
      label: 'Activation Status',
      tint: colors.primary,
    }),
    optionalStatusCard(result.miLockStatus, {
      cleanAware: true,
      icon: 'lock-closed-outline',
      label: 'Mi Lock Status',
    }),
    optionalStatusCard(result.miLostStatus, {
      cleanAware: true,
      icon: 'shield-outline',
      label: 'Mi Lost Status',
    }),
    {
      cleanAware: true,
      icon: 'lock-closed',
      label: 'Find My iPhone',
      value: result.icloudLock,
    },
    {
      icon: 'globe',
      label: 'SIM Lock',
      tint: colors.primary,
      value: result.simLock,
    },
    {
      icon: 'cellular',
      label: 'Carrier',
      tint: colors.accent,
      value: result.carrier,
    },
    optionalStatusCard(result.serialNumber, {
      icon: 'barcode-outline',
      label: 'Serial Number',
      tint: colors.textSecondary,
    }),
    optionalStatusCard(result.purchaseDate, {
      icon: 'calendar-outline',
      label: 'Purchase Date',
      tint: colors.textSecondary,
    }),
    optionalStatusCard(result.purchaseCountry, {
      icon: 'earth-outline',
      label: 'Purchase Country',
      tint: colors.textSecondary,
    }),
    optionalStatusCard(result.warranty, {
      icon: 'shield-checkmark-outline',
      label: 'Warranty',
      tint: colors.success,
    }),
    optionalStatusCard(result.refurbished, {
      cleanAware: true,
      icon: 'refresh-outline',
      label: 'Refurbished',
    }),
    optionalStatusCard(result.demoUnit, {
      cleanAware: true,
      icon: 'phone-portrait-outline',
      label: 'Demo Unit',
    }),
    optionalStatusCard(result.mdmStatus, {
      cleanAware: true,
      icon: 'briefcase-outline',
      label: 'MDM Status',
    }),
  ].filter((card): card is ImeiResultStatusCard => Boolean(card));
}

function optionalStatusCard(
  value: string | undefined,
  config: Omit<ImeiResultStatusCard, 'value'>
): ImeiResultStatusCard | null {
  return value ? { ...config, value } : null;
}
