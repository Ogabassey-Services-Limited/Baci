/**
 * Repair booking types consumed from the dashboard bookings API
 * (`/api/repairs/bookings*`, `apps/web/src/lib/repairs/booking-mappers.ts`).
 * Pure types only — no runtime logic, so no colocated test (CLAUDE.md).
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

export type RepairServiceType = 'dropoff' | 'pickup';

export interface RepairBookingSummary {
  id: string;
  ticketNumber: number;
  status: RepairStatus;
  deviceLabel: string;
  deviceType: string;
  deviceModel: string;
  repairTypeLabel: string | null;
  quotedPrice: number | null;
  estimatedCost: number | null;
  serviceType: RepairServiceType;
  createdAt: string;
  customerName: string;
}

export interface RepairBookingDetail extends RepairBookingSummary {
  customerEmail: string;
  customerPhone: string;
  issueDescription: string;
  adminNotes: string | null;
  pickupAddress: string | null;
  preferredDate: string | null;
  updatedAt: string;
  shipmentId: string | null;
  quoteId: string | null;
  trackingNumber: string | null;
}

export interface RepairBookingsListResponse {
  bookings: RepairBookingSummary[];
  total: number;
}

export interface RepairBookingDetailResponse {
  booking: RepairBookingDetail;
}
