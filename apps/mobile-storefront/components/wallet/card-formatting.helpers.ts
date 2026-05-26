import type { SavedVtuCard } from '@/lib/vtu-checkout';

export function getExpiryPart(value: string | null, minimumLength = 2) {
  // Paystack can return one- or four-digit expiry pieces; keep only the card-display suffix.
  const digits = value?.replace(/\D/g, '');
  return digits
    ? digits.slice(-minimumLength).padStart(minimumLength, '0')
    : null;
}

export function formatCardMeta(card: SavedVtuCard) {
  const lastFour = card.last4 ? `•••• ${card.last4}` : '••••';
  const expiryMonth = getExpiryPart(card.exp_month);
  const expiryYear = getExpiryPart(card.exp_year);
  const expiry =
    expiryMonth && expiryYear ? `${expiryMonth}/${expiryYear}` : 'Saved card';
  return `${lastFour} · ${expiry}`;
}
