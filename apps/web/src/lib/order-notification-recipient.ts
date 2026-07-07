import { z } from 'zod';

export type OrderNotificationRecipientFailureReason =
  | 'missing_customer_email'
  | 'invalid_customer_email';

export type OrderNotificationRecipientResult =
  | { ok: true; email: string }
  | { ok: false; reason: OrderNotificationRecipientFailureReason };

const customerEmailSchema = z.email();

export function resolveOrderNotificationRecipient(
  customerEmail: unknown
): OrderNotificationRecipientResult {
  if (typeof customerEmail !== 'string') {
    return { ok: false, reason: 'missing_customer_email' };
  }

  const email = customerEmail.trim().toLowerCase();
  if (!email) {
    return { ok: false, reason: 'missing_customer_email' };
  }

  const parsedEmail = customerEmailSchema.safeParse(email);
  if (!parsedEmail.success) {
    return { ok: false, reason: 'invalid_customer_email' };
  }

  return { ok: true, email: parsedEmail.data };
}
