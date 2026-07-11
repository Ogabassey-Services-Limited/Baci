import { describe, expect, it } from 'vitest';
import {
  generateRepairConfirmationEmail,
  generateRepairConfirmationText,
} from './repair-confirmation';

const basePayload = {
  ticketNumber: 42,
  customerName: 'Jane Doe',
  merchantName: 'Ogabassey',
  deviceLabel: 'Smartphone — iPhone 13 Pro Max',
  serviceType: 'dropoff' as const,
};

describe('Repair confirmation email', () => {
  describe('ticket number', () => {
    it('includes the ticket number in both HTML and text output', () => {
      const output = [
        generateRepairConfirmationEmail(basePayload),
        generateRepairConfirmationText(basePayload),
      ].join('\n');

      expect(output).toContain('42');
      expect(output).toContain('Ticket');
    });
  });

  describe('quoted price', () => {
    it('shows the repair type and price when a catalogue quote is linked', () => {
      const output = [
        generateRepairConfirmationEmail({
          ...basePayload,
          repairTypeLabel: 'Screen Replacement',
          quotedPrice: 25000,
          isFromPrice: true,
        }),
        generateRepairConfirmationText({
          ...basePayload,
          repairTypeLabel: 'Screen Replacement',
          quotedPrice: 25000,
          isFromPrice: true,
        }),
      ].join('\n');

      expect(output).toContain('Screen Replacement');
      expect(output).toContain('₦25,000');
      expect(output).toContain('From');
    });

    it('omits price copy entirely for free-text bookings without a quote', () => {
      const html = generateRepairConfirmationEmail(basePayload);
      const text = generateRepairConfirmationText(basePayload);

      expect(html).not.toContain('₦');
      expect(text).not.toContain('₦');
    });
  });

  describe('pickup vs dropoff', () => {
    it('includes the pickup address when service type is pickup', () => {
      const output = [
        generateRepairConfirmationEmail({
          ...basePayload,
          serviceType: 'pickup',
          pickupAddress: '12 Adeola Odeku Street, Victoria Island',
        }),
        generateRepairConfirmationText({
          ...basePayload,
          serviceType: 'pickup',
          pickupAddress: '12 Adeola Odeku Street, Victoria Island',
        }),
      ].join('\n');

      expect(output).toContain('Pickup');
      expect(output).toContain('12 Adeola Odeku Street, Victoria Island');
    });

    it('mentions drop-off without a pickup address for dropoff bookings', () => {
      const html = generateRepairConfirmationEmail(basePayload);

      expect(html).toContain('Drop-off');
    });
  });

  describe('currency formatting', () => {
    it('uses the provided currency for HTML and text', () => {
      const payload = {
        ...basePayload,
        repairTypeLabel: 'Battery Replacement',
        quotedPrice: 15000,
        currency: 'GHS',
      };
      const output = [
        generateRepairConfirmationEmail(payload),
        generateRepairConfirmationText(payload),
      ].join('\n');

      expect(output).not.toContain('₦');
    });
  });

  describe('HTML escaping (XSS prevention)', () => {
    it('escapes user-controlled fields', () => {
      const XSS = '<script>alert(1)</script>';
      const html = generateRepairConfirmationEmail({
        ...basePayload,
        customerName: XSS,
        deviceLabel: XSS,
        merchantName: XSS,
        pickupAddress: XSS,
        serviceType: 'pickup',
      });

      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
  });
});
