import {
  BadgeCheck,
  Barcode,
  Briefcase,
  Calendar,
  Cloud,
  Globe,
  Hammer,
  Lock,
  MapPin,
  RefreshCw,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tag,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { ImeiCheckField } from '@baci/shared/imei';
import { isStatusClean } from './imei-checker-is-status-clean';
import type { ImeiToneKey } from './imei-checker-tone';
import type { ImeiResult } from './imei-checker-types';

export interface ImeiResultStatusCard {
  icon: LucideIcon;
  label: string;
  value: string;
  toneKey: ImeiToneKey;
}

function cleanAwareTone(value: string): ImeiToneKey {
  return isStatusClean(value) ? 'safe' : 'danger';
}

function optionalStatusCard(
  value: string | undefined,
  config: Omit<ImeiResultStatusCard, 'value'>
): ImeiResultStatusCard | null {
  return value ? { ...config, value } : null;
}

/**
 * Builds the ordered result status-card list, gated the same way the mobile
 * checker gates them: core provider checks (blacklist/iCloud/SIM/carrier) are
 * gated on the tier's checksIncluded so a tier that never ran that check
 * (e.g. a serial-only report) doesn't show a wall of empty/"Unknown" cards.
 * Every other field is purely value-gated — shown only when the provider
 * actually returned a non-empty string, regardless of tier.
 */
export function getImeiResultStatusCards(
  result: ImeiResult,
  checksIncluded: readonly ImeiCheckField[]
): ImeiResultStatusCard[] {
  const included = new Set<ImeiCheckField>(checksIncluded);

  return [
    included.has('blacklistStatus')
      ? {
          icon: ShieldCheck,
          label: 'Blacklist Status',
          value: result.blacklistStatus,
          toneKey: cleanAwareTone(result.blacklistStatus),
        }
      : null,
    optionalStatusCard(result.activationStatus, {
      icon: Sparkles,
      label: 'Activation Status',
      toneKey: 'primary',
    }),
    optionalStatusCard(result.miLockStatus, {
      icon: Lock,
      label: 'Mi Lock Status',
      toneKey: cleanAwareTone(result.miLockStatus ?? ''),
    }),
    optionalStatusCard(result.miLostStatus, {
      icon: Shield,
      label: 'Mi Lost Status',
      toneKey: cleanAwareTone(result.miLostStatus ?? ''),
    }),
    // Both iCloud cards ride on the single 'icloud' check (icloudLock has no
    // separate ImeiCheckField of its own).
    included.has('icloud')
      ? {
          icon: Cloud,
          label: 'iCloud Status',
          value: result.icloud,
          toneKey: cleanAwareTone(result.icloud),
        }
      : null,
    included.has('icloud')
      ? {
          icon: Lock,
          label: 'Find My iPhone',
          value: result.icloudLock,
          toneKey: cleanAwareTone(result.icloudLock),
        }
      : null,
    included.has('simLock')
      ? {
          icon: Globe,
          label: 'SIM Lock',
          value: result.simLock,
          toneKey: 'accent',
        }
      : null,
    included.has('carrier')
      ? {
          icon: Smartphone,
          label: 'Carrier',
          value: result.carrier,
          toneKey: 'accent',
        }
      : null,
    optionalStatusCard(result.serialNumber, {
      icon: Barcode,
      label: 'Serial Number',
      toneKey: 'muted',
    }),
    optionalStatusCard(result.purchaseDate, {
      icon: Calendar,
      label: 'Purchase Date',
      toneKey: 'muted',
    }),
    optionalStatusCard(result.purchaseCountry, {
      icon: MapPin,
      label: 'Purchase Country',
      toneKey: 'muted',
    }),
    // Fixed "safe" tone (not value-gated by isStatusClean): warranty presence
    // is informational/positive framing, mirroring the mobile checker.
    optionalStatusCard(result.warranty, {
      icon: BadgeCheck,
      label: 'Warranty',
      toneKey: 'safe',
    }),
    optionalStatusCard(result.refurbished, {
      icon: RefreshCw,
      label: 'Refurbished',
      toneKey: cleanAwareTone(result.refurbished ?? ''),
    }),
    optionalStatusCard(result.demoUnit, {
      icon: Smartphone,
      label: 'Demo Unit',
      toneKey: cleanAwareTone(result.demoUnit ?? ''),
    }),
    optionalStatusCard(result.mdmStatus, {
      icon: Briefcase,
      label: 'MDM Status',
      toneKey: cleanAwareTone(result.mdmStatus ?? ''),
    }),
    optionalStatusCard(result.knoxGuardStatus, {
      icon: Lock,
      label: 'Knox Guard',
      toneKey: cleanAwareTone(result.knoxGuardStatus ?? ''),
    }),
    // Neutral tint: gsxCoverage is raw provider text that can read
    // "Expired"/"Out of Coverage" — a fixed success tone would mislead.
    optionalStatusCard(result.gsxCoverage, {
      icon: ShieldCheck,
      label: 'Coverage',
      toneKey: 'muted',
    }),
    optionalStatusCard(result.repairEligibility, {
      icon: Wrench,
      label: 'Repair Eligibility',
      toneKey: 'muted',
    }),
    optionalStatusCard(result.repairHistory, {
      icon: Hammer,
      label: 'Repair History',
      toneKey: cleanAwareTone(result.repairHistory ?? ''),
    }),
    optionalStatusCard(result.replacementHistory, {
      icon: RefreshCw,
      label: 'Replacement History',
      toneKey: cleanAwareTone(result.replacementHistory ?? ''),
    }),
    optionalStatusCard(result.partNumber, {
      icon: Tag,
      label: 'Part Number',
      toneKey: 'muted',
    }),
  ].filter((card): card is ImeiResultStatusCard => Boolean(card));
}
