import { apiGet, apiPatch, apiPost } from '@/lib/api-client';
import type {
  RepairBookingDetail,
  RepairBookingSummary,
} from '@/lib/repairs/booking-mappers';
import type { BookRepairPickupResult } from '@/lib/repairs/pickup-shipment-utils';
import type { RepairSettingsInput } from '@/schemas/merchant-features';

/**
 * Typed browser client for the repairs bookings + settings dashboard API.
 * Wraps the CSRF-aware api-client helpers and unwraps route payloads.
 */

const BASE = '/api/repairs';

export interface BookingsListResponse {
  bookings: RepairBookingSummary[];
  total: number;
}

export interface BookingsListParams {
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export function listBookings(
  params: BookingsListParams = {}
): Promise<BookingsListResponse> {
  const qs = new URLSearchParams();
  if (params.status) {
    qs.set('status', params.status);
  }
  if (params.q) {
    qs.set('q', params.q);
  }
  if (params.limit != null) {
    qs.set('limit', String(params.limit));
  }
  if (params.offset != null) {
    qs.set('offset', String(params.offset));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<BookingsListResponse>(`${BASE}/bookings${suffix}`);
}

export function getBooking(
  id: string
): Promise<{ booking: RepairBookingDetail }> {
  return apiGet<{ booking: RepairBookingDetail }>(`${BASE}/bookings/${id}`);
}

export interface UpdateBookingBody {
  status?: string;
  estimated_cost?: number | null;
  admin_notes?: string | null;
}

export function updateBooking(
  id: string,
  input: UpdateBookingBody
): Promise<{ booking: RepairBookingDetail }> {
  return apiPatch<{ booking: RepairBookingDetail }>(
    `${BASE}/bookings/${id}`,
    input
  );
}

export interface PickupResponse {
  result?: BookRepairPickupResult;
  ok?: boolean;
  manual?: boolean;
}

export function requestPickup(
  id: string,
  mode: 'auto' | 'manual'
): Promise<PickupResponse> {
  return apiPost<PickupResponse>(`${BASE}/bookings/${id}/pickup`, { mode });
}

export interface RepairSettingsResponse {
  repairSettings: RepairSettingsInput | null;
  repairsCatalogEnabled: boolean;
}

export function getRepairSettings(): Promise<RepairSettingsResponse> {
  return apiGet<RepairSettingsResponse>(`${BASE}/settings`);
}

export function saveRepairSettings(
  input: RepairSettingsInput
): Promise<{ repairSettings: RepairSettingsInput }> {
  return apiPatch<{ repairSettings: RepairSettingsInput }>(
    `${BASE}/settings`,
    input
  );
}
