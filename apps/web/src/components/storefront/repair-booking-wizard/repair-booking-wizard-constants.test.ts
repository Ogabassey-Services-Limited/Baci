import { describe, expect, it } from 'vitest';
import {
  buildPreselectionIssueDescription,
  buildRepairWizardDefaultValues,
  type RepairBookingPreselection,
} from './repair-booking-wizard-constants';

const preselectionWithQuote: RepairBookingPreselection = {
  deviceId: 'device-1',
  deviceLabel: 'Apple iPhone 13',
  deviceSlug: 'apple-iphone-13',
  deviceType: 'Smartphone',
  quoteId: 'quote-1',
  quoteLabel: 'Screen Replacement',
  quotePrice: 25000,
  isFromPrice: true,
};

const preselectionDeviceOnly: RepairBookingPreselection = {
  deviceId: 'device-1',
  deviceLabel: 'Apple iPhone 13',
  deviceSlug: 'apple-iphone-13',
  deviceType: 'Smartphone',
};

describe('buildPreselectionIssueDescription', () => {
  it('mentions the service name when a quote is preselected', () => {
    expect(buildPreselectionIssueDescription(preselectionWithQuote)).toBe(
      'Screen Replacement for Apple iPhone 13.'
    );
  });

  it('falls back to a generic device-only description when no quote is set', () => {
    expect(buildPreselectionIssueDescription(preselectionDeviceOnly)).toBe(
      'Repair needed for Apple iPhone 13.'
    );
  });
});

describe('buildRepairWizardDefaultValues', () => {
  it('returns blank free-text defaults with no preselection', () => {
    const defaults = buildRepairWizardDefaultValues(undefined);

    expect(defaults.deviceType).toBe('Smartphone');
    expect(defaults.deviceModel).toBe('');
    expect(defaults.issueDescription).toBe('');
    expect(defaults.deviceId).toBeUndefined();
    expect(defaults.quoteId).toBeUndefined();
  });

  it('seeds deviceId, quoteId, deviceModel and issueDescription from the preselection', () => {
    const defaults = buildRepairWizardDefaultValues(preselectionWithQuote);

    expect(defaults.deviceId).toBe('device-1');
    expect(defaults.quoteId).toBe('quote-1');
    expect(defaults.deviceModel).toBe('Apple iPhone 13');
    expect(defaults.deviceType).toBe('Smartphone');
    expect(defaults.issueDescription).toBe(
      'Screen Replacement for Apple iPhone 13.'
    );
  });

  it('falls back to device type "Other" when the preselection type is unrecognized', () => {
    const defaults = buildRepairWizardDefaultValues({
      ...preselectionDeviceOnly,
      deviceType: null,
    });

    expect(defaults.deviceType).toBe('Other');
  });
});
