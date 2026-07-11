import {
  Gamepad2,
  HelpCircle,
  Laptop,
  type LucideIcon,
  Smartphone,
  Tablet,
  Watch,
} from 'lucide-react';
import type { z } from 'zod';
import type {
  RepairBookingInput,
  repairBookingSchema,
} from '@/lib/validations/repair';

export interface RepairWizardStep {
  id: string;
  title: string;
}

export const REPAIR_WIZARD_STEPS: readonly RepairWizardStep[] = [
  { id: 'device', title: 'Device Details' },
  { id: 'contact', title: 'Contact Info' },
  { id: 'review', title: 'Review & Submit' },
];

export interface RepairDeviceTypeOption {
  id: string;
  icon: LucideIcon;
  label: string;
}

export const REPAIR_DEVICE_TYPE_OPTIONS: readonly RepairDeviceTypeOption[] = [
  { id: 'Smartphone', icon: Smartphone, label: 'Smartphone' },
  { id: 'Laptop', icon: Laptop, label: 'Laptop' },
  { id: 'Tablet', icon: Tablet, label: 'Tablet' },
  { id: 'Console', icon: Gamepad2, label: 'Console' },
  { id: 'Smartwatch', icon: Watch, label: 'Smartwatch' },
  { id: 'Other', icon: HelpCircle, label: 'Other' },
];

/**
 * Device/quote preselection resolved server-side (from `/[slug]/repair?device=&quote=`
 * query params) and passed down so the wizard's device step opens on a
 * confirmation panel instead of the free-text form.
 */
export interface RepairBookingPreselection {
  deviceId: string;
  deviceSlug: string;
  deviceLabel: string;
  deviceType: string | null;
  quoteId?: string;
  quoteLabel?: string;
  quotePrice?: number;
  isFromPrice?: boolean;
}

/**
 * Prefills the issue-description field when a catalogue device/quote is
 * preselected, so step 0 validates without requiring the customer to type
 * anything — they can still edit/add detail before continuing.
 */
export function buildPreselectionIssueDescription(
  preselection: RepairBookingPreselection
): string {
  return preselection.quoteLabel
    ? `${preselection.quoteLabel} for ${preselection.deviceLabel}.`
    : `Repair needed for ${preselection.deviceLabel}.`;
}

const REPAIR_FORM_BASE_DEFAULTS = {
  customerEmail: '',
  customerName: '',
  customerPhone: '',
  pickupAddress: '',
  serviceType: 'dropoff' as const,
};

/**
 * Builds the wizard's initial form values. With no preselection this is the
 * plain free-text defaults; with a catalogue device/quote preselected it
 * seeds `deviceId`/`quoteId`/`deviceModel`/`issueDescription` so step 0 opens
 * on a valid, submittable confirmation panel.
 */
export function buildRepairWizardDefaultValues(
  preselection: RepairBookingPreselection | undefined
): z.input<typeof repairBookingSchema> {
  if (!preselection) {
    return {
      ...REPAIR_FORM_BASE_DEFAULTS,
      deviceModel: '',
      deviceType: 'Smartphone',
      issueDescription: '',
    };
  }

  return {
    ...REPAIR_FORM_BASE_DEFAULTS,
    deviceId: preselection.deviceId,
    deviceModel: preselection.deviceLabel,
    deviceType:
      (preselection.deviceType as RepairBookingInput['deviceType']) || 'Other',
    issueDescription: buildPreselectionIssueDescription(preselection),
    quoteId: preselection.quoteId,
  };
}
