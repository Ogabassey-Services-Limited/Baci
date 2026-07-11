/**
 * Repair booking status lifecycle — mirrors the web source of truth
 * (`apps/web/src/lib/repairs/repair-status.ts`) so the mobile detail screen
 * only ever offers transitions the dashboard API will actually accept.
 * Kept as a single cohesive module (matching the web mirror) rather than
 * split across files, since every export describes the same lifecycle.
 */

import type { ThemeColors } from '@/constants/theme';
import type { RepairStatus } from '@/types/repair-booking';

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

const STATUS_TRANSITIONS: Record<RepairStatus, readonly RepairStatus[]> = {
  pending: ['confirmed', 'in_progress', 'rejected', 'cancelled'],
  confirmed: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  rejected: [],
};

export function getRepairStatusLabel(status: RepairStatus): string {
  return REPAIR_STATUS_LABELS[status];
}

export function getAllowedNextRepairStatuses(
  status: RepairStatus
): readonly RepairStatus[] {
  return STATUS_TRANSITIONS[status];
}

export function isTerminalRepairStatus(status: RepairStatus): boolean {
  return STATUS_TRANSITIONS[status].length === 0;
}

export interface RepairStatusColors {
  background: string;
  text: string;
}

export function getRepairStatusColors(
  status: RepairStatus,
  colors: ThemeColors
): RepairStatusColors {
  switch (status) {
    case 'pending':
      return { background: colors.warningLight, text: colors.warning };
    case 'confirmed':
      return { background: colors.infoLight, text: colors.info };
    case 'in_progress':
      return { background: colors.primaryLight, text: colors.primary };
    case 'completed':
      return { background: colors.successLight, text: colors.success };
    case 'cancelled':
      return { background: colors.border, text: colors.textMuted };
    case 'rejected':
      return { background: colors.errorLight, text: colors.error };
    default:
      return { background: colors.border, text: colors.textSecondary };
  }
}
