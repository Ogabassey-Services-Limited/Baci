import { isValidPhone } from '@baci/shared/lib';
import { hasMinimumPhoneDigits } from '@/lib/phone';

/**
 * Post-merge guard for repair-center PATCH. Schema alone cannot see persisted
 * pickup_enabled, so the route merges first and then requires a usable phone
 * whenever the effective settings keep courier pickup enabled.
 */
export function isMergedRepairPickupPhoneValid(settings: {
  pickup_enabled?: unknown;
  contact_phone?: unknown;
}): boolean {
  if (settings.pickup_enabled !== true) {
    return true;
  }

  return (
    typeof settings.contact_phone === 'string' &&
    hasMinimumPhoneDigits(settings.contact_phone) &&
    isValidPhone(settings.contact_phone)
  );
}
