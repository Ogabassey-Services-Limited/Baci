import { sanitizeText } from '@/lib/sanitize-core';

const MAX_INVITE_EMAIL_LENGTH = 254;
const MAX_INVITE_EMAIL_LABEL_LENGTH = 64;

export function formatInviteEmail(rawEmail: string): {
  value: string;
  label: string;
} {
  const value = sanitizeText(rawEmail, MAX_INVITE_EMAIL_LENGTH);

  if (value.length <= MAX_INVITE_EMAIL_LABEL_LENGTH) {
    return { value, label: value };
  }

  return {
    value,
    label: `${value.slice(0, MAX_INVITE_EMAIL_LABEL_LENGTH - 3)}...`,
  };
}
