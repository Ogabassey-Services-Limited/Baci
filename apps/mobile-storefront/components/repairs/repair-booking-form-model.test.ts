import { describe, expect, it } from '@jest/globals';
import {
  buildBookingPayload,
  type RepairBookingFormState,
  validateBookingForm,
} from './repair-booking-form-model';

const validState: RepairBookingFormState = {
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@example.com',
  customerPhone: '08012345678',
  deviceModel: 'iPhone 13',
  issueDescription: 'The screen is cracked and needs replacing.',
  serviceType: 'dropoff',
  pickupAddress: '',
};

describe('validateBookingForm', () => {
  it('returns no errors for a valid drop-off form', () => {
    expect(validateBookingForm(validState)).toEqual({});
  });

  it('flags a short name', () => {
    const errors = validateBookingForm({ ...validState, customerName: 'A' });
    expect(errors.customerName).toBeDefined();
  });

  it('flags an invalid email', () => {
    const errors = validateBookingForm({
      ...validState,
      customerEmail: 'not-an-email',
    });
    expect(errors.customerEmail).toMatch(/valid email/i);
  });

  it('flags a short phone number', () => {
    const errors = validateBookingForm({
      ...validState,
      customerPhone: '123',
    });
    expect(errors.customerPhone).toBeDefined();
  });

  it('flags an empty device model', () => {
    const errors = validateBookingForm({ ...validState, deviceModel: '' });
    expect(errors.deviceModel).toBeDefined();
  });

  it('flags a too-short issue description', () => {
    const errors = validateBookingForm({
      ...validState,
      issueDescription: 'broke',
    });
    expect(errors.issueDescription).toBeDefined();
  });

  it('requires a pickup address when service type is pickup', () => {
    const errors = validateBookingForm({
      ...validState,
      serviceType: 'pickup',
      pickupAddress: '',
    });
    expect(errors.pickupAddress).toMatch(/pickup address/i);
  });

  it('accepts a pickup with a valid address', () => {
    const errors = validateBookingForm({
      ...validState,
      serviceType: 'pickup',
      pickupAddress: '12 Allen Avenue, Ikeja, Lagos',
    });
    expect(errors.pickupAddress).toBeUndefined();
  });
});

describe('buildBookingPayload', () => {
  it('trims fields and includes device/quote ids when provided', () => {
    const payload = buildBookingPayload(
      {
        ...validState,
        customerName: '  Ada Lovelace  ',
        customerEmail: '  Ada@Example.com ',
      },
      'Smartphone',
      'd1',
      'q1'
    );

    expect(payload).toEqual({
      customerName: 'Ada Lovelace',
      customerEmail: 'ada@example.com',
      customerPhone: '08012345678',
      deviceType: 'Smartphone',
      deviceModel: 'iPhone 13',
      issueDescription: 'The screen is cracked and needs replacing.',
      serviceType: 'dropoff',
      deviceId: 'd1',
      quoteId: 'q1',
    });
  });

  it('omits device/quote ids and pickup address for a free-text drop-off', () => {
    const payload = buildBookingPayload(validState, 'Other', null, null);

    expect(payload.deviceId).toBeUndefined();
    expect(payload.quoteId).toBeUndefined();
    expect(payload.pickupAddress).toBeUndefined();
  });

  it('includes a trimmed pickup address when service type is pickup', () => {
    const payload = buildBookingPayload(
      {
        ...validState,
        serviceType: 'pickup',
        pickupAddress: '  12 Allen Avenue  ',
      },
      'Smartphone',
      null,
      null
    );

    expect(payload.serviceType).toBe('pickup');
    expect(payload.pickupAddress).toBe('12 Allen Avenue');
  });
});
