import { isRepairStatus, type RepairStatus } from '@/lib/repairs/repair-status';

/** Explicit column lists (never select('*')). */
export const BOOKING_LIST_COLUMNS =
  'id, ticket_number, status, device_type, device_model, repair_type_label, quoted_price, estimated_cost, service_type, created_at, customer_name';

export const BOOKING_DETAIL_COLUMNS = `${BOOKING_LIST_COLUMNS}, customer_email, customer_phone, issue_description, admin_notes, pickup_address, preferred_date, updated_at, shipment_id, quote_id`;

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
  serviceType: 'dropoff' | 'pickup';
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

type Row = Record<string, unknown>;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asStatus(value: unknown): RepairStatus {
  return isRepairStatus(value) ? value : 'pending';
}

function asServiceType(value: unknown): 'dropoff' | 'pickup' {
  return value === 'pickup' ? 'pickup' : 'dropoff';
}

function deviceLabel(deviceType: string, deviceModel: string): string {
  return `${deviceType} ${deviceModel}`.trim() || 'Device';
}

export function mapBookingRow(row: Row): RepairBookingSummary {
  const deviceType = asString(row.device_type);
  const deviceModel = asString(row.device_model);
  return {
    id: asString(row.id),
    ticketNumber: Number(row.ticket_number),
    status: asStatus(row.status),
    deviceLabel: deviceLabel(deviceType, deviceModel),
    deviceType,
    deviceModel,
    repairTypeLabel: asNullableString(row.repair_type_label),
    quotedPrice: asNullableNumber(row.quoted_price),
    estimatedCost: asNullableNumber(row.estimated_cost),
    serviceType: asServiceType(row.service_type),
    createdAt: asString(row.created_at),
    customerName: asString(row.customer_name),
  };
}

export function mapBookingDetail(
  row: Row,
  trackingNumber: string | null = null
): RepairBookingDetail {
  return {
    ...mapBookingRow(row),
    customerEmail: asString(row.customer_email),
    customerPhone: asString(row.customer_phone),
    issueDescription: asString(row.issue_description),
    adminNotes: asNullableString(row.admin_notes),
    pickupAddress: asNullableString(row.pickup_address),
    preferredDate: asNullableString(row.preferred_date),
    updatedAt: asString(row.updated_at),
    shipmentId: asNullableString(row.shipment_id),
    quoteId: asNullableString(row.quote_id),
    trackingNumber,
  };
}
