import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockClearBadge = jest.fn();
const mockHandleNotificationResponse = jest.fn();
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

type NotificationResponse = Parameters<
  typeof processPushNotificationResponse
>[0];

const createResponse = (
  identifier: string,
  data: Record<string, unknown>
): NotificationResponse =>
  ({
    notification: {
      request: {
        identifier,
        content: { data },
      },
    },
  }) as NotificationResponse;

describe('processPushNotificationResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
