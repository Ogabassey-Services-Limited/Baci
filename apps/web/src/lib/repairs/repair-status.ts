/**
 * Repair booking status lifecycle — the single source of truth for allowed
 * status transitions, human labels, colour classes and the customer-facing
 * timeline. Shared by the dashboard bookings UI, the status-update API route,
 * and the public customer status page (generalized from the Ogabassey
 * order-status helpers so it lives outside any one storefront skin).
 */

export const REPAIR_STATUSES = [
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'rejected',
] as const;

export type RepairStatus = (typeof REPAIR_STATUSES)[number];

/** Happy-path order rendered as a horizontal timeline on the status page. */
export const REPAIR_STATUS_TIMELINE: readonly RepairStatus[] = [
  'pending',
  'confirmed',
  'in_progress',
  'completed',
];

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

const TERMINAL_STATUSES: readonly RepairStatus[] = [
  'completed',
  'cancelled',
  'rejected',
];

/**
 * Allowed forward transitions. Staff can always cancel/reject an in-flight
 * booking; terminal states cannot transition further.
 */
const STATUS_TRANSITIONS: Record<RepairStatus, readonly RepairStatus[]> = {
  pending: ['confirmed', 'in_progress', 'rejected', 'cancelled'],
  confirmed: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  rejected: [],
};

export function isRepairStatus(value: unknown): value is RepairStatus {
  return (
    typeof value === 'string' &&
    (REPAIR_STATUSES as readonly string[]).includes(value)
  );
}

export function isTerminalRepairStatus(status: RepairStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function getAllowedNextRepairStatuses(
  status: RepairStatus
): readonly RepairStatus[] {
  return STATUS_TRANSITIONS[status];
}

export function canTransitionRepairStatus(
  from: RepairStatus,
  to: RepairStatus
): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

const STATUS_COLOR_CLASSES: Record<RepairStatus, string> = {
  pending: 'bg-blue-50 text-blue-600 border-blue-100',
  confirmed: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  in_progress: 'bg-amber-50 text-amber-600 border-amber-100',
  completed: 'bg-green-50 text-green-600 border-green-100',
  cancelled: 'bg-gray-50 text-gray-600 border-gray-100',
  rejected: 'bg-red-50 text-red-600 border-red-100',
};

export function getRepairStatusColorClasses(status: string): string {
  if (isRepairStatus(status)) {
    return STATUS_COLOR_CLASSES[status];
  }
  return 'bg-gray-50 text-gray-600 border-gray-100';
}

export function getRepairStatusLabel(status: string): string {
  return isRepairStatus(status) ? REPAIR_STATUS_LABELS[status] : status;
}
