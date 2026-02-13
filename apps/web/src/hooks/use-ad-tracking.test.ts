import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ad-tracking-cookies', () => ({
  getAdTrackingData: vi.fn(() => ({ fbclid: 'test-fbclid' })),
  generateEventId: vi.fn(() => 'evt-12345'),
  shouldApplyLimitedDataUse: vi.fn(() => false),
}));

import {
  generateEventId,
  getAdTrackingData,
  shouldApplyLimitedDataUse,
} from '@/lib/ad-tracking-cookies';
import { useAdTracking } from './use-ad-tracking';

describe('useAdTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads tracking data on mount', () => {
    const { result } = renderHook(() => useAdTracking());
    expect(getAdTrackingData).toHaveBeenCalled();
    expect(result.current.trackingData).toEqual({ fbclid: 'test-fbclid' });
  });

  it('detects non-California user by default', () => {
    const { result } = renderHook(() => useAdTracking());
    expect(result.current.isCaliforniaUser).toBe(false);
  });

  it('detects California user when timezone matches', () => {
    vi.mocked(shouldApplyLimitedDataUse).mockReturnValue(true);
    const { result } = renderHook(() => useAdTracking());
    expect(result.current.isCaliforniaUser).toBe(true);
  });

  it('generates a purchase event ID', () => {
    const { result } = renderHook(() => useAdTracking());
    let eventId = '';
    act(() => {
      eventId = result.current.generatePurchaseEventId();
    });
    expect(generateEventId).toHaveBeenCalled();
    expect(eventId).toBe('evt-12345');
    expect(result.current.purchaseEventId).toBe('evt-12345');
  });

  it('returns tracking data for order creation', () => {
    const { result } = renderHook(() => useAdTracking());
    const orderData = result.current.getTrackingForOrder('custom-evt');
    expect(orderData).toMatchObject({
      fbclid: 'test-fbclid',
      eventId: 'custom-evt',
    });
  });

  it('fires Facebook pixel via trackFacebookPurchase', () => {
    const mockFbq = vi.fn();
    Object.defineProperty(window, 'fbq', { value: mockFbq, writable: true });

    const { result } = renderHook(() => useAdTracking());
    let eventId = '';
    act(() => {
      eventId = result.current.trackFacebookPurchase(5000, 'NGN', ['prod-1']);
    });
    expect(eventId).toBe('evt-12345');
    expect(mockFbq).toHaveBeenCalledWith(
      'track',
      'Purchase',
      expect.objectContaining({ value: 5000, currency: 'NGN' }),
      { eventID: 'evt-12345' }
    );
  });

  it('trackPurchase returns tracking data with eventId', () => {
    const { result } = renderHook(() => useAdTracking());
    let trackingResult:
      | ReturnType<typeof result.current.trackPurchase>
      | undefined;
    act(() => {
      trackingResult = result.current.trackPurchase(1000, 'NGN');
    });
    expect(trackingResult?.eventId).toBe('evt-12345');
  });
});
