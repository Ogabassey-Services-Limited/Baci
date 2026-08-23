import type { ShippingAddress } from '@/lib/shipping/types';
import { normalizeGiglLocation } from './providers/gigl.location-normalizer';

function coordinatesDiffer(
  left: number | undefined,
  right: number | undefined
): boolean {
  if (left == null && right == null) return false;
  if (left == null || right == null) return true;
  return Math.abs(left - right) > 1e-6;
}

/**
 * Compares the origin fields that affect domestic carrier routing. GIGL and
 * checkout accept equivalent Abuja/FCT labels, so canonicalize those labels
 * before deciding that a saved quote needs a refresh.
 */
export function domesticSendersDiffer(
  stored: ShippingAddress,
  resolved: ShippingAddress
): boolean {
  return (
    normalizeGiglLocation(stored.city) !==
      normalizeGiglLocation(resolved.city) ||
    normalizeGiglLocation(stored.state) !==
      normalizeGiglLocation(resolved.state) ||
    coordinatesDiffer(stored.latitude, resolved.latitude) ||
    coordinatesDiffer(stored.longitude, resolved.longitude)
  );
}
