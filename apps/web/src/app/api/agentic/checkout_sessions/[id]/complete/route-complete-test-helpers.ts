import { createHmac, randomBytes } from 'node:crypto';

export const completionConfirmationSecret = randomBytes(32).toString('hex');

export function validHumanConfirmation() {
  const confirmedAt = new Date().toISOString();
  const payload = JSON.stringify({
    amount: 500000,
    confirmed_at: confirmedAt,
    currency: 'NGN',
    session_id: 'agentic_session_1',
    type: 'human_confirmation',
  });
  return {
    amount: 500000,
    confirmed_at: confirmedAt,
    currency: 'NGN',
    session_id: 'agentic_session_1',
    signature: createHmac('sha256', completionConfirmationSecret)
      .update(payload)
      .digest('hex'),
    type: 'human_confirmation',
  };
}
