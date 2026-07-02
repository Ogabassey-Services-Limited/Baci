function trimmedEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function positiveIntegerEnv(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

const GIGL_DEV_BASE_URL = 'https://dev-thirdpartynode.theagilitysystems.com';

export const GIGL_BASE_URL =
  trimmedEnv(process.env.GIGL_BASE_URL) ||
  (process.env.NODE_ENV === 'production' ? undefined : GIGL_DEV_BASE_URL);
export const GIGL_EMAIL = trimmedEnv(process.env.GIGL_EMAIL);
export const GIGL_PASSWORD = trimmedEnv(process.env.GIGL_PASSWORD);
export const GIGL_TOKEN_EXPIRY_MS = 20 * 24 * 60 * 60 * 1000;
export const GIGL_QUOTE_TIMEOUT_MS =
  positiveIntegerEnv(process.env.GIGL_QUOTE_TIMEOUT_MS) || 5000;
export const GIGL_BOOKING_TIMEOUT_MS =
  positiveIntegerEnv(process.env.GIGL_BOOKING_TIMEOUT_MS) || 10000;
export const GIGL_TRACKING_TIMEOUT_MS =
  positiveIntegerEnv(process.env.GIGL_TRACKING_TIMEOUT_MS) || 5000;
export const GIGL_STATIONS_TIMEOUT_MS =
  positiveIntegerEnv(process.env.GIGL_STATIONS_TIMEOUT_MS) || 5000;
export const GIGL_STATIONS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function isGiglRuntimeConfigured(): boolean {
  return Boolean(GIGL_BASE_URL && GIGL_EMAIL && GIGL_PASSWORD);
}

export interface GiglToken {
  token: string;
  userChannelCode: string;
  customerType: number;
  expiresAt: number;
}

export type GiglApiEnvelope = {
  status: number;
  message?: string;
  data?: unknown;
};

export enum VehicleType {
  Car = 0,
  Bike = 1,
  Van = 2,
  Truck = 3,
}

export enum ShipmentType {
  Special = 0,
  Regular = 1,
  Ecommerce = 2,
}

export enum PickupOptions {
  HomeDelivery = 0,
  ServiceCentre = 1,
}

export type GiglFetchOptions = RequestInit & { timeout?: number };

export type GiglLog = (
  level: 'info' | 'warn' | 'error',
  message: string,
  data?: Record<string, unknown>
) => void;

export interface GiglProviderIo {
  safeFetch(url: string, options?: GiglFetchOptions): Promise<Response>;
  log: GiglLog;
}

export interface GiglQuoteIo extends GiglProviderIo {
  generateQuoteId(): string;
  getQuoteExpiry(hours?: number): Date;
}

function createTimeoutError(message: string): Error {
  const error = new Error(message);
  error.name = 'TimeoutError';
  return error;
}

function createAbortError(signal: AbortSignal, message: string): Error {
  const reason = signal.reason;
  if (reason instanceof Error) {
    return reason;
  }

  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

export function isGiglAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}

export function withGiglRequestTimeout<T>(
  request: Promise<T>,
  timeout?: number,
  signal?: AbortSignal,
  timeoutMessage = 'GIGL request timed out',
  abortMessage = 'GIGL request aborted'
): Promise<T> {
  if ((!timeout || timeout <= 0) && !signal) {
    return request;
  }

  if (signal?.aborted) {
    return Promise.reject(createAbortError(signal, abortMessage));
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;
  const guards: Promise<T>[] = [];

  if (timeout && timeout > 0) {
    guards.push(
      new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(createTimeoutError(timeoutMessage));
        }, timeout);
      })
    );
  }

  if (signal) {
    guards.push(
      new Promise<T>((_resolve, reject) => {
        abortHandler = () => reject(createAbortError(signal, abortMessage));
        signal.addEventListener('abort', abortHandler, { once: true });
      })
    );
  }

  return Promise.race([request, ...guards]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (signal && abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }
  });
}

export function withGiglTokenRequestTimeout(
  tokenRequest: Promise<GiglToken>,
  timeout?: number,
  signal?: AbortSignal
): Promise<GiglToken> {
  return withGiglRequestTimeout(
    tokenRequest,
    timeout,
    signal,
    'GIGL API token request timed out',
    'GIGL API token request aborted'
  );
}

export function getConfiguredGiglBaseUrl(): string {
  if (!GIGL_BASE_URL) {
    throw new Error('GIGL base URL not configured');
  }

  return GIGL_BASE_URL;
}

export function getVehicleTypeForWeight(totalWeight: number): VehicleType {
  return totalWeight > 30 ? VehicleType.Van : VehicleType.Bike;
}

export function parseGiglProviderRateId(providerRateId?: string): {
  receiverStationId?: number;
  pickupOption: PickupOptions;
  vehicleType?: VehicleType;
} {
  if (!providerRateId) {
    return { pickupOption: PickupOptions.HomeDelivery };
  }

  const [providerCode, stationIdValue, pickupOptionValue, vehicleTypeValue] =
    providerRateId.split('_');
  if (providerCode !== 'GIGL') {
    return { pickupOption: PickupOptions.HomeDelivery };
  }

  const receiverStationId = Number(stationIdValue);
  const pickupOption = Number(pickupOptionValue);
  const vehicleType = Number(vehicleTypeValue);

  return {
    receiverStationId: Number.isFinite(receiverStationId)
      ? receiverStationId
      : undefined,
    pickupOption:
      pickupOption === PickupOptions.ServiceCentre
        ? PickupOptions.ServiceCentre
        : PickupOptions.HomeDelivery,
    vehicleType: Object.values(VehicleType).includes(vehicleType)
      ? (vehicleType as VehicleType)
      : undefined,
  };
}
