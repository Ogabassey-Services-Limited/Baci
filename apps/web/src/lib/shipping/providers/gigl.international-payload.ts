import { OrderShipmentBookingError } from '../order-shipment-booking-utils';
import type { QuoteRequest, ShipmentItem, ShippingAddress } from '../types';
import type { GiglApiClient } from './gigl.auth';
import {
  GIGL_BOOKING_TIMEOUT_MS,
  type GiglProviderIo,
  type GiglToken,
} from './gigl.constants';

export type { InternationalRateSelection } from './gigl.international-rate-id';
export {
  GIGL_INTERNATIONAL_PROVIDER_RATE_PREFIX,
  internationalRateId,
  isGiglInternationalProviderRate,
  parseInternationalRateId,
} from './gigl.international-rate-id';

import { giglSchemas } from './gigl.schemas';

export interface GiglInternationalCountry {
  CountryId: number;
  CountryName?: string;
  CountryCode?: string;
  CountryShortCode?: string;
  IsInternationalShippingCountry?: boolean;
}

export type DestinationCountryResolution =
  | { status: 'found'; countryId: number }
  | { status: 'lookup_failed'; envelopeStatus?: number; responseStatus: number }
  | { status: 'not_found' };

type DimensionalShipmentItem = ShipmentItem & {
  height?: unknown;
  length?: unknown;
  width?: unknown;
};

interface PackageDimensions {
  Height: number;
  Length: number;
  Width: number;
}

const MAX_DIMENSIONAL_PACKAGES_PER_ITEM = 100;
const MAX_TOTAL_DIMENSIONAL_PACKAGES = 500;

function throwInternationalPackageLimit(message: string, code: string): never {
  throw new OrderShipmentBookingError(message, 400, code);
}

export function isNigeriaAddress(address: ShippingAddress): boolean {
  const countryCode = address.countryCode.trim().toUpperCase();
  const country = address.country.trim().toLowerCase();
  return countryCode === 'NG' || countryCode === 'NGA' || country === 'nigeria';
}

export function totalDeclaredValue(
  request: Pick<QuoteRequest, 'items'>
): number {
  return request.items.reduce(
    (sum, item) => sum + item.value * item.quantity,
    0
  );
}

function readPositiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function getPackageDimensions(
  item: DimensionalShipmentItem
): PackageDimensions | undefined {
  const length = readPositiveNumber(item.length);
  const width = readPositiveNumber(item.width);
  const height = readPositiveNumber(item.height);
  return length && width && height
    ? { Length: length, Width: width, Height: height }
    : undefined;
}

function readHsCode(item: ShipmentItem): string {
  const hsCode = item.hsCode?.trim();
  if (!hsCode) {
    throw new OrderShipmentBookingError(
      `HS code is required for international item "${item.name}".`,
      400,
      'GIGL_INTERNATIONAL_ITEM_HS_CODE_MISSING'
    );
  }

  return hsCode;
}

export function buildInternationalItems(items: ShipmentItem[]) {
  return items.map((item) => {
    const dimensions = getPackageDimensions(item);
    const hsCode = readHsCode(item);
    return {
      InternationalShipmentItemType: 0,
      Description: item.description || item.name,
      Weight: item.weight,
      Quantity: item.quantity,
      Nature: 1,
      IsVolumetric: Boolean(dimensions),
      ...(dimensions ?? {}),
      PackagingType: 1,
      Value: item.value,
      HSCode: hsCode,
    };
  });
}

export function buildInternationalPackages(items: ShipmentItem[]) {
  let totalPackageCount = 0;

  return items.flatMap((item) => {
    const dimensions = getPackageDimensions(item);
    if (!dimensions) {
      return [];
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throwInternationalPackageLimit(
        'Invalid package quantity for GIGL international item',
        'GIGL_INTERNATIONAL_PACKAGE_QUANTITY_INVALID'
      );
    }
    if (item.quantity > MAX_DIMENSIONAL_PACKAGES_PER_ITEM) {
      throwInternationalPackageLimit(
        'Too many packages for one GIGL international item',
        'GIGL_INTERNATIONAL_ITEM_PACKAGE_LIMIT'
      );
    }

    const packageCount = item.quantity;
    totalPackageCount += packageCount;
    if (totalPackageCount > MAX_TOTAL_DIMENSIONAL_PACKAGES) {
      throwInternationalPackageLimit(
        'Too many packages for GIGL international shipment',
        'GIGL_INTERNATIONAL_SHIPMENT_PACKAGE_LIMIT'
      );
    }

    return Array.from({ length: packageCount }, () => ({
      Weight: item.weight,
      ...dimensions,
    }));
  });
}

export function estimatedDays(dateValue?: string): number {
  if (!dateValue) {
    return 7;
  }
  const timestamp = Date.parse(dateValue);
  if (!Number.isFinite(timestamp)) {
    return 7;
  }
  const days = Math.ceil((timestamp - Date.now()) / 86_400_000);
  return Math.max(days, 1);
}

export function internationalServiceTier(deliveryType?: number): string {
  return deliveryType === 2
    ? 'International Express'
    : 'International Standard';
}

export function firstString(
  ...values: Array<string | undefined>
): string | undefined {
  return values.find((value) => value && value.trim().length > 0);
}

function normalizeMatchValue(value?: string): string {
  return value?.trim().toLowerCase() ?? '';
}

export function matchDestinationCountry(
  receiver: ShippingAddress,
  countries: GiglInternationalCountry[]
): GiglInternationalCountry | undefined {
  const countryCode = normalizeMatchValue(receiver.countryCode);
  const countryName = normalizeMatchValue(receiver.country);
  return countries.find((country) => {
    if (country.IsInternationalShippingCountry !== true) {
      return false;
    }
    return [
      country.CountryShortCode,
      country.CountryCode,
      country.CountryName,
    ].some((value) => {
      const normalized = normalizeMatchValue(value);
      return normalized === countryCode || normalized === countryName;
    });
  });
}

export function buildCountryLookupUrl(
  baseUrl: string,
  receiver: ShippingAddress
): string {
  return `${baseUrl}/country/get?CountryName=${encodeURIComponent(
    receiver.country
  )}`;
}

export async function resolveDestinationCountryId(
  apiClient: GiglApiClient,
  tokenData: GiglToken,
  request: Pick<QuoteRequest, 'receiver'>,
  timeout: number,
  signal: AbortSignal
): Promise<DestinationCountryResolution> {
  const { envelope, response } =
    await apiClient.safeFetchEnvelopeWithAccessToken(
      buildCountryLookupUrl(apiClient.baseUrl, request.receiver),
      tokenData,
      () => ({
        method: 'GET',
        timeout,
        signal,
      })
    );

  if (!response.ok || envelope?.status !== 200) {
    return {
      status: 'lookup_failed',
      envelopeStatus: envelope?.status,
      responseStatus: response.status,
    };
  }

  const countries = apiClient.parseEnvelopeData(
    envelope,
    giglSchemas.countryData,
    'country'
  );
  const countryId = matchDestinationCountry(
    request.receiver,
    countries
  )?.CountryId;
  return countryId === undefined
    ? { status: 'not_found' }
    : { status: 'found', countryId };
}

export async function generateInternationalInvoiceLabel(
  apiClient: GiglApiClient,
  tokenData: GiglToken,
  trackingNumber: string,
  io: GiglProviderIo,
  signal: AbortSignal
): Promise<string | undefined> {
  const { envelope, response } =
    await apiClient.safeFetchEnvelopeWithAccessToken(
      `${apiClient.baseUrl}/invoice/generate`,
      tokenData,
      () => ({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Waybill: trackingNumber }),
        timeout: GIGL_BOOKING_TIMEOUT_MS,
        signal,
      })
    );

  if (!response.ok || envelope?.status !== 200) {
    io.log('warn', 'GIGL international invoice generation failed', {
      status: response.status,
    });
    return undefined;
  }

  try {
    const invoiceData = apiClient.parseEnvelopeData(
      envelope,
      giglSchemas.invoiceData,
      'invoice'
    );
    return invoiceData.WaybillLabel;
  } catch (error) {
    io.log('warn', 'GIGL international invoice label missing', {
      error: String(error),
    });
    return undefined;
  }
}
