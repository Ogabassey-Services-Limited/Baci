import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

type NotificationResponse = import('expo-notifications').NotificationResponse;

const mockClearBadge = jest.fn();
const mockHandleNotificationResponse =
  jest.fn<
    typeof import('@/services/push-notifications')['handleNotificationResponse']
  >();
const mockTrackNotificationInteraction = jest.fn();
const mockWarn = jest.fn();

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ warn: mockWarn }),
}));

jest.mock('@/services/analytics', () => ({
  trackNotificationInteraction: mockTrackNotificationInteraction,
}));

jest.mock('@/services/push-notifications', () => ({
  clearBadge: mockClearBadge,
  handleNotificationResponse: mockHandleNotificationResponse,
}));

const { processPushNotificationResponse } =
  require('./process-push-notification-response') as typeof import('./process-push-notification-response');

type ProcessedNotificationResponse = Parameters<
  typeof processPushNotificationResponse
>[0];

const createResponse = (
  identifier: string,
  data: Record<string, unknown>,
  date = 1000
): ProcessedNotificationResponse =>
  ({
    notification: {
      date,
      request: {
        identifier,
        content: { data },
      },
    },
  }) as NotificationResponse;

describe('processPushNotificationResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearBadge.mockReset();
    mockHandleNotificationResponse.mockReset();
    mockTrackNotificationInteraction.mockReset();
    mockWarn.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('deduplicates by delivery identifier while retaining payload attribution', () => {
    const navigate = jest.fn();
    const response = createResponse('utility-delivery-1', {
      notification_id: 'utility-campaign-1',
      notification_type: 'promotion',
    });

    processPushNotificationResponse(response, navigate);
    processPushNotificationResponse(response, navigate);

    expect(mockTrackNotificationInteraction).toHaveBeenCalledTimes(1);
    expect(mockTrackNotificationInteraction).toHaveBeenCalledWith(
      'opened',
      'promotion',
      'utility-campaign-1'
    );
    expect(mockHandleNotificationResponse).toHaveBeenCalledTimes(1);
    expect(mockClearBadge).toHaveBeenCalledTimes(1);
  });

  it('processes separate occurrences that reuse a recurring request identifier', () => {
    const navigate = jest.fn();
    const firstOccurrence = createResponse(
      'utility-recurring',
      { notification_type: 'savings_reminder' },
      2000
    );
    const secondOccurrence = createResponse(
      'utility-recurring',
      { notification_type: 'savings_reminder' },
      3000
    );

    processPushNotificationResponse(firstOccurrence, navigate);
    processPushNotificationResponse(secondOccurrence, navigate);

    expect(mockTrackNotificationInteraction).toHaveBeenCalledTimes(2);
    expect(mockHandleNotificationResponse).toHaveBeenCalledTimes(2);
    expect(mockClearBadge).toHaveBeenCalledTimes(2);
  });

  it('retries user-facing handling after a navigation error', () => {
    jest.useFakeTimers();
    const navigate = jest.fn();
    mockHandleNotificationResponse.mockImplementation(
      (
        _response: NotificationResponse,
        navigateFromResponse: (
          screen: string,
          params?: Record<string, string>
        ) => void
      ) => {
        navigateFromResponse('wallet');
      }
    );
    navigate.mockImplementationOnce(() => {
      throw new Error('navigator is not ready');
    });
    const response = createResponse('utility-navigation-failure', {
      notification_type: 'promotion',
    });

    expect(() =>
      processPushNotificationResponse(response, navigate)
    ).not.toThrow();
    expect(mockHandleNotificationResponse).toHaveBeenCalledTimes(1);
    expect(mockClearBadge).not.toHaveBeenCalled();

    jest.runOnlyPendingTimers();

    expect(mockTrackNotificationInteraction).toHaveBeenCalledTimes(1);
    expect(mockHandleNotificationResponse).toHaveBeenCalledTimes(2);
    expect(mockClearBadge).toHaveBeenCalledTimes(1);
  });

  it('continues response handling when analytics tracking throws', () => {
    mockTrackNotificationInteraction.mockImplementation(() => {
      throw new Error('analytics unavailable');
    });
    const navigate = jest.fn();
    const response = createResponse('utility-analytics-failure', {
      notification_type: 'promotion',
    });

    expect(() =>
      processPushNotificationResponse(response, navigate)
    ).not.toThrow();

    expect(mockHandleNotificationResponse).toHaveBeenCalledWith(
      response,
      navigate
    );
    expect(mockClearBadge).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledTimes(1);
  });
});
