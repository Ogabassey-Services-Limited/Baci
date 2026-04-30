import { createHmac } from 'node:crypto';

export const completionConfirmationSecret = 'test-confirmation-secret';

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
