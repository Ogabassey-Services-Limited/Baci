import { describe, expect, it } from '@jest/globals';
import { SUPPORT_WHATSAPP_PHONE } from '@/constants/Support';
import {
  buildRepairWhatsappUrl,
  REPAIR_SERVICES,
  REPAIR_WORKFLOW_STEPS,
} from './repairs-content';

describe('repairs-content', () => {
  it('builds the default booking WhatsApp URL', () => {
    const url = buildRepairWhatsappUrl(SUPPORT_WHATSAPP_PHONE);

    expect(url).toContain(`https://wa.me/${SUPPORT_WHATSAPP_PHONE}?text=`);
    expect(url).toContain(
      encodeURIComponent("Hello! I'd like to book a device repair.")
    );
  });

  it('includes the selected service in the booking WhatsApp URL', () => {
    const url = buildRepairWhatsappUrl(SUPPORT_WHATSAPP_PHONE, 'Battery Boost');

    expect(url).toContain('Service%3A%20Battery%20Boost');
  });

  it('encodes special service names and omits service text for empty values', () => {
    const specialService = 'Screen & Frame / Repair?';

    const specialUrl = buildRepairWhatsappUrl(
      SUPPORT_WHATSAPP_PHONE,
      specialService
    );
    const emptyServiceUrl = buildRepairWhatsappUrl(SUPPORT_WHATSAPP_PHONE, '');

    expect(specialUrl).toContain(
      encodeURIComponent(`Service: ${specialService}`)
    );
    expect(emptyServiceUrl).not.toContain('Service%3A');
  });

  it('exports non-empty collections with required item shape', () => {
    expect(REPAIR_SERVICES.length).toBeGreaterThan(0);
    expect(REPAIR_WORKFLOW_STEPS.length).toBeGreaterThan(0);

    for (const service of REPAIR_SERVICES) {
      expect(service.title).toBeTruthy();
      expect(service.price).toBeTruthy();
      expect(service.desc).toBeTruthy();
      expect(service.icon).toBeTruthy();
    }

    for (const step of REPAIR_WORKFLOW_STEPS) {
      expect(step.title).toBeTruthy();
      expect(step.desc).toBeTruthy();
      expect(step.icon).toBeTruthy();
    }
  });
});
