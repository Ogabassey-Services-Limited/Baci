import { resolveLocationStateLabel } from '@baci/shared/lib';
import {
  NIGERIAN_CITIES_FALLBACK,
  NIGERIAN_STATES_FALLBACK,
} from '@/app/api/shipping/locations/fallback-locations';

interface QuoteReceiverLocation {
  address: string;
  city: string;
  country?: string;
  countryCode?: string;
  state: string;
}

function normalizeLocation(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\bosogbo\b/g, 'oshogbo')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findKnownState(value: string): string | null {
  const candidate = value
    .replace(/\b\d{5,6}\b/g, '')
    .replace(/\s+state\s*$/i, '')
    .trim();
  if (!candidate) return null;

  const resolved = resolveLocationStateLabel(
    candidate,
    NIGERIAN_STATES_FALLBACK
  );
  return NIGERIAN_STATES_FALLBACK.includes(resolved) ? resolved : null;
}

function inferStateFromCity(city: string): string | null {
  const normalizedCity = normalizeLocation(city);
  if (!normalizedCity) return null;

  const matches = Object.entries(NIGERIAN_CITIES_FALLBACK)
    .filter(([, cities]) =>
      cities.some(
        (candidate) => normalizeLocation(candidate) === normalizedCity
      )
    )
    .map(([state]) => state);

  return matches.length === 1 ? matches[0] : null;
}

export function normalizeNigerianQuoteReceiver<T extends QuoteReceiverLocation>(
  receiver: T,
  shipmentType: 'domestic' | 'international'
): T {
  if (shipmentType === 'international') return receiver;

  const countryCode = receiver.countryCode?.trim().toUpperCase();
  const country = receiver.country?.trim().toLowerCase();
  if (
    (countryCode && countryCode !== 'NG') ||
    (!countryCode && country && country !== 'nigeria')
  ) {
    return receiver;
  }

  const canonicalState =
    findKnownState(receiver.state) ??
    receiver.address
      .split(',')
      .map(findKnownState)
      .find((state): state is string => state !== null) ??
    inferStateFromCity(receiver.city);

  if (!canonicalState || canonicalState === receiver.state) return receiver;
  return { ...receiver, state: canonicalState };
}
