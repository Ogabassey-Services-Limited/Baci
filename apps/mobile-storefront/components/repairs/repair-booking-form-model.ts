import type { RepairDeviceType } from '@baci/shared/repairs';
import type { RepairBookingRequest } from '@/lib/repair-catalog-schemas';

export interface RepairBookingFormState {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deviceModel: string;
  issueDescription: string;
  serviceType: 'dropoff' | 'pickup';
  pickupAddress: string;
}

export type RepairBookingFieldErrors = Partial<
  Record<keyof RepairBookingFormState, string>
>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[\d\s-]{10,}$/;

/**
 * Client-side validation mirroring the web `repairBookingSchema`
 * (`apps/web/src/lib/validations/repair.ts`). This is a UX pre-check only —
 * the server re-validates with the same rules through the booking route, so
 * these messages exist to catch mistakes before a round trip, never as the
 * authoritative boundary.
 */
export function validateBookingForm(
  state: RepairBookingFormState
): RepairBookingFieldErrors {
  const errors: RepairBookingFieldErrors = {};

  if (state.customerName.trim().length < 2) {
    errors.customerName = 'Enter your full name.';
  }
  if (!EMAIL_REGEX.test(state.customerEmail.trim())) {
    errors.customerEmail = 'Enter a valid email address.';
  }
  if (!PHONE_REGEX.test(state.customerPhone.trim())) {
    errors.customerPhone = 'Enter a valid phone number.';
  }
  if (state.deviceModel.trim().length < 2) {
    errors.deviceModel = 'Enter the device model.';
  }
  if (state.issueDescription.trim().length < 10) {
    errors.issueDescription = 'Describe the issue in at least 10 characters.';
  }
  if (state.serviceType === 'pickup' && state.pickupAddress.trim().length < 5) {
    errors.pickupAddress = 'Enter a valid pickup address.';
  }

  return errors;
}

/**
 * Builds the `RepairBookingRequest` sent to the booking route. Trims text,
 * lowercases the email, and only attaches `deviceId`/`quoteId`/`pickupAddress`
 * when they apply (the free-text path books with neither device nor quote).
 */
export function buildBookingPayload(
  state: RepairBookingFormState,
  deviceType: RepairDeviceType,
  deviceId: string | null,
  quoteId: string | null
): RepairBookingRequest {
  const payload: RepairBookingRequest = {
    customerName: state.customerName.trim(),
    customerEmail: state.customerEmail.trim().toLowerCase(),
    customerPhone: state.customerPhone.trim(),
    deviceType,
    deviceModel: state.deviceModel.trim(),
    issueDescription: state.issueDescription.trim(),
    serviceType: state.serviceType,
  };

  if (state.serviceType === 'pickup') {
    payload.pickupAddress = state.pickupAddress.trim();
  }
  if (deviceId) {
    payload.deviceId = deviceId;
  }
  if (quoteId) {
    payload.quoteId = quoteId;
  }

  return payload;
}
