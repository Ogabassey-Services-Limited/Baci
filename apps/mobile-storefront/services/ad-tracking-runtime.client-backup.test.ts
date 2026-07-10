import { describe, expect, it, jest } from '@jest/globals';
import {
  createNativeModules,
  installAdTrackingRuntimeTestReset,
  mockError,
  mockGetTrackingPermissionStatus,
  mockLoadAdTrackingNativeModules,
  mockWarn,
  setMockExpoConfigExtra,
} from './ad-tracking-runtime.test-utils';

installAdTrackingRuntimeTestReset();

describe('ad-tracking runtime client backup events', () => {
  it('initializes native SDKs and sends client backup events when bridges succeed', async () => {
    const initializeSDK = jest.fn();
    const setAdvertiserTrackingEnabled = jest.fn(() => Promise.resolve(true));
    const logEvent = jest.fn();
    const logAEMEvent = jest.fn();
    const trackEvent = jest.fn();
    const initializeTikTok = jest.fn(() => true);
    mockGetTrackingPermissionStatus.mockResolvedValue({ status: 'granted' });
    setMockExpoConfigExtra({
      apiUrl: 'https://api.test',
      facebookAppId: 'fb-test',
      facebookClientToken: 'client-test',
      tiktokBusiness: {
        isConfigured: true,
      },
    });
    mockLoadAdTrackingNativeModules.mockResolvedValue(
      createNativeModules({
        AEMReporterIOS: {
          logAEMEvent,
        },
        AppEventsLogger: {
          logEvent,
        },
        FBSettings: {
          initializeSDK,
          setAdvertiserTrackingEnabled,
        },
        TikTokBusiness: {
          initialize: initializeTikTok,
          trackEvent,
        },
      })
    );

    const { initAdTracking, requestTrackingPermission, sendClientBackup } =
      await import('./ad-tracking-runtime');

    await initAdTracking();
    await expect(requestTrackingPermission()).resolves.toBe('granted');
    sendClientBackup(
      'evt-success',
      'fb_mobile_purchase',
      'Purchase',
      12_000,
      'NGN',
      { content_name: 'Phone' }
    );

    expect(initializeSDK).toHaveBeenCalledTimes(1);
    expect(initializeTikTok).toHaveBeenCalledTimes(1);
    expect(setAdvertiserTrackingEnabled).toHaveBeenCalledWith(true);
    expect(logEvent).toHaveBeenCalledWith('fb_mobile_purchase', 12_000, {
      _eventId: 'evt-success',
      content_name: 'Phone',
    });
    expect(logAEMEvent).toHaveBeenCalledWith(
      'fb_mobile_purchase',
      12_000,
      'NGN',
      { content_name: 'Phone' }
    );
    expect(trackEvent).toHaveBeenCalledWith(
      'Purchase',
      'evt-success',
      expect.arrayContaining([
        expect.objectContaining({ key: 'content_name', value: 'Phone' }),
      ])
    );
    expect(mockWarn).not.toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });

  it('keeps client backup tracking non-fatal when native event logging fails', async () => {
    const facebookEventError = new TypeError('undefined is not a function');
    const aemEventError = new TypeError('undefined is not a function');
    mockGetTrackingPermissionStatus.mockResolvedValue({ status: 'granted' });
    mockLoadAdTrackingNativeModules.mockResolvedValue(
      createNativeModules({
        AEMReporterIOS: {
          logAEMEvent: jest.fn(() => {
            throw aemEventError;
          }),
        },
        AppEventsLogger: {
          logEvent: jest.fn(() => {
            throw facebookEventError;
          }),
        },
      })
    );

    const { initAdTracking, sendClientBackup } = await import(
      './ad-tracking-runtime'
    );

    await initAdTracking();

    expect(() => {
      sendClientBackup('evt-1', 'fb_mobile_add_to_cart', null, 4500, 'NGN', {
        content_name: 'Phone',
      });
    }).not.toThrow();
    expect(mockWarn).toHaveBeenCalledWith(
      'Facebook event log failed:',
      facebookEventError
    );
    expect(mockWarn).toHaveBeenCalledWith(
      'Facebook AEM event log failed:',
      aemEventError
    );
  });

  it('drops client backup events when ATT is not authorized', async () => {
    const logEvent = jest.fn();
    const logAEMEvent = jest.fn();
    const trackEvent = jest.fn();
    mockLoadAdTrackingNativeModules.mockResolvedValue(
      createNativeModules({
        AEMReporterIOS: { logAEMEvent },
        AppEventsLogger: { logEvent },
        TikTokBusiness: { initialize: jest.fn(() => true), trackEvent },
      })
    );

    const { initAdTracking, sendClientBackup } = await import(
      './ad-tracking-runtime'
    );

    await initAdTracking();
    sendClientBackup(
      'evt-denied',
      'fb_mobile_purchase',
      'Purchase',
      1,
      'NGN',
      {}
    );

    expect(mockLoadAdTrackingNativeModules).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
    expect(logAEMEvent).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
