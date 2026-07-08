import { describe, expect, it } from 'vitest';
import {
  generateRepairStatusUpdateEmail,
  generateRepairStatusUpdateText,
} from './repair-status-update';

const base = {
  ticketNumber: 1042,
  customerName: 'Ada Lovelace',
  merchantName: 'Ogabassey',
  deviceLabel: 'Smartphone — iPhone 15',
  status: 'completed' as const,
};

describe('generateRepairStatusUpdateEmail', () => {
  it('includes the ticket, status label and per-status message', () => {
    const html = generateRepairStatusUpdateEmail(base);
    expect(html).toContain('Ticket #1042');
    expect(html).toContain('Completed');
    expect(html).toContain('Your repair is complete');
  });

  it('renders a tracking button only when a tracking URL is present', () => {
    const withTracking = generateRepairStatusUpdateEmail({
      ...base,
      status: 'in_progress',
      trackingUrl: 'https://store.example.com/track/TRK-1',
    });
    expect(withTracking).toContain('Track courier pickup');
    expect(withTracking).toContain('https://store.example.com/track/TRK-1');

    expect(generateRepairStatusUpdateEmail(base)).not.toContain(
      'Track courier pickup'
    );
  });

  it('escapes untrusted merchant/customer values', () => {
    const html = generateRepairStatusUpdateEmail({
      ...base,
      customerName: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('generateRepairStatusUpdateText', () => {
  it('summarizes the status in plain text', () => {
    const text = generateRepairStatusUpdateText({
      ...base,
      status: 'confirmed',
    });
    expect(text).toContain('Ticket #1042');
    expect(text).toContain('Status: Confirmed');
  });

  it('adds the tracking line only when present', () => {
    expect(
      generateRepairStatusUpdateText({
        ...base,
        trackingUrl: 'https://x/track/1',
      })
    ).toContain('Track courier pickup: https://x/track/1');
    expect(generateRepairStatusUpdateText(base)).not.toContain(
      'Track courier pickup:'
    );
  });
});
