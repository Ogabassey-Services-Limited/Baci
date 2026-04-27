/**
 * Support contact constants
 * Single source of truth for WhatsApp numbers and support URLs
 */

/** Canonical E.164 support phone number for call actions */
export const SUPPORT_PHONE_E164 = '+2348146978921';

/** WhatsApp phone number for customer support (with country code, no +) */
export const SUPPORT_WHATSAPP_PHONE = SUPPORT_PHONE_E164.replace(/^\+/, '');

/** Support email address used across customer-facing support surfaces */
export const SUPPORT_EMAIL = 'support@ogabassey.com';
