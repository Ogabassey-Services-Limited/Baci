import { describe, expect, it } from 'vitest';
import { summarizeInsuranceConfirmation } from './insurance-confirmation-summary';

describe('summarizeInsuranceConfirmation', () => {
  it('reports a plain confirm with no insurance', () => {
    expect(summarizeInsuranceConfirmation({})).toEqual({
      title: 'Order Confirmed',
      description: 'Order processed successfully.',
    });
  });

  it('reports an active policy by its number', () => {
    expect(
      summarizeInsuranceConfirmation({
        insurance: { success: true, results: [{ policyNumber: 'MC-1' }] },
      })
    ).toEqual({
      title: 'Order Confirmed',
      description: 'Policy Active: MC-1',
    });
  });

  it('surfaces a partial failure even when a policy was created', () => {
    const toast = summarizeInsuranceConfirmation({
      insurance: {
        success: true,
        results: [
          { success: true, policyNumber: 'MC-1' },
          { success: false, error: 'per-item details required' },
        ],
      },
    });

    expect(toast.variant).toBe('destructive');
    expect(toast.title).toMatch(/partially failed/i);
    expect(toast.description).toContain('MC-1');
    expect(toast.description).toContain('per-item details required');
  });

  it('reports a total insurance failure (request-level error)', () => {
    const toast = summarizeInsuranceConfirmation({
      insuranceError: 'MyCover unavailable',
    });

    expect(toast.variant).toBe('destructive');
    expect(toast.title).toBe('Order Confirmed, Insurance Failed');
    expect(toast.description).toContain('MyCover unavailable');
  });

  it('treats a request-level success:false (no results) as a failure', () => {
    const toast = summarizeInsuranceConfirmation({
      insurance: {
        success: false,
        message: 'No items in this order require assurance.',
      },
    });

    expect(toast.variant).toBe('destructive');
    expect(toast.title).toBe('Order Confirmed, Insurance Failed');
    expect(toast.description).toContain('No items in this order require');
  });

  it('reports a failure when every item failed and no policy exists', () => {
    const toast = summarizeInsuranceConfirmation({
      insurance: {
        success: true,
        results: [{ success: false, error: 'device rejected' }],
      },
    });

    expect(toast.variant).toBe('destructive');
    expect(toast.title).toBe('Order Confirmed, Insurance Failed');
    expect(toast.description).toContain('device rejected');
  });
});
