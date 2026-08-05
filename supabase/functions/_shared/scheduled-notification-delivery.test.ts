import { describe, expect, it } from 'vitest';
import { parseExpoTicketResults } from './scheduled-notification-delivery.ts';

describe('parseExpoTicketResults', () => {
  it('preserves each mixed Expo ticket result for its corresponding token', () => {
    const result = parseExpoTicketResults(
      {
        data: [
          { id: 'ticket-accepted', status: 'ok' },
          { details: { error: 'DeviceNotRegistered' }, status: 'error' },
        ],
      },
      2
    );

    expect(result).toEqual({
      errorCodes: ['', 'DeviceNotRegistered'],
      statuses: ['accepted', 'rejected'],
      ticketIds: ['ticket-accepted', ''],
    });
  });

  it('marks malformed or incomplete provider responses as unresolved', () => {
    expect(parseExpoTicketResults({ data: [{ status: 'ok' }] }, 2)).toBeNull();
  });
});
