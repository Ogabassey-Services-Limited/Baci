/**
 * Shared display types for the repairs services catalogue.
 *
 * Consumed by the web storefront read APIs (Phase 1) and by the mobile
 * storefront/admin apps in later phases. Pure types, no runtime logic.
 */

export type RepairDeviceType =
  | 'Smartphone'
  | 'Laptop'
  | 'Tablet'
  | 'Console'
  | 'Smartwatch'
  | 'Other';

export interface RepairDeviceSummary {
  id: string;
  brand: string;
  model: string;
  slug: string;
  deviceType: RepairDeviceType | null;
  imageUrl: string | null;
  productId: string | null;
}

export interface RepairDeviceBrandGroup {
  brand: string;
  devices: RepairDeviceSummary[];
}

export interface RepairQuoteSummary {
  id: string;
  serviceTypeId: string;
  serviceTypeName: string;
  price: number;
  isFromPrice: boolean;
  partQuality: string | null;
  turnaround: string | null;
  warrantyDays: number | null;
  description: string | null;
}

export interface RepairProductKeySpec {
  label: string;
  value: string;
}

export interface RepairLinkedProductSummary {
  id: string;
  slug: string | null;
  name: string | null;
  imageUrl: string | null;
  keySpecs: RepairProductKeySpec[];
}

export interface RepairDeviceDetail {
  device: RepairDeviceSummary;
  quotes: RepairQuoteSummary[];
  product: RepairLinkedProductSummary | null;
}

export interface RepairDevicesResponse {
  groups: RepairDeviceBrandGroup[];
}

export interface RepairBookingResult {
  id: string;
  ticketNumber: number;
}
