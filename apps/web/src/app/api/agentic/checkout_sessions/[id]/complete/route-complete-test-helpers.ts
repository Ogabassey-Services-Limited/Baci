import { createHmac, randomBytes } from 'node:crypto';

export const completionConfirmationSecret = randomBytes(32).toString('hex');

export function validHumanConfirmation(amount = 500000) {
  const confirmedAt = new Date().toISOString();
  const payload = JSON.stringify({
    amount,
    confirmed_at: confirmedAt,
    currency: 'NGN',
    session_id: 'agentic_session_1',
    type: 'human_confirmation',
  });
  return {
    amount,
    confirmed_at: confirmedAt,
    currency: 'NGN',
    session_id: 'agentic_session_1',
    signature: createHmac('sha256', completionConfirmationSecret)
      .update(payload)
      .digest('hex'),
    type: 'human_confirmation',
  };
}
