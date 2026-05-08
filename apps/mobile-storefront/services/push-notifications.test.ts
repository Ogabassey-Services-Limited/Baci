import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockUpsert =
  jest.fn<
    (...args: unknown[]) => Promise<{ error: null | { message: string } }>
  >();
const mockFrom = jest.fn((_table: string) => ({ upsert: mockUpsert }));
const mockLogger = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};

jest.mock('@baci/shared/lib', () => ({
  getStorefrontNotificationNavigationTarget: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { eas: { projectId: 'project-id' } } },
}));

jest.mock('expo-device', () => ({
  isDevice: true,
  modelName: 'iPhone',
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  AndroidImportance: { DEFAULT: 'default', HIGH: 'high' },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => mockLogger,
}));

jest.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

const { handleNotificationResponse, savePushTokenToServer } =
  require('./push-notifications') as typeof import('./push-notifications');
const { getStorefrontNotificationNavigationTarget } = jest.requireMock(
  '@baci/shared/lib'
) as {
  getStorefrontNotificationNavigationTarget: jest.Mock;
};

describe('savePushTokenToServer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpsert.mockResolvedValue({ error: null });
  });

  it('trims token, user id, and merchant id before upserting', async () => {
    const saved = await savePushTokenToServer(
      '  ExponentPushToken[fresh]  ',
      '  user-1  ',
      '  merchant-1  '
    );

    expect(saved).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('push_tokens');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'ExponentPushToken[fresh]',
        user_id: 'user-1',
        merchant_id: 'merchant-1',
      }),
      { onConflict: 'token' }
    );
  });

  it.each([
    ['token', '', 'user-1', 'merchant-1'],
    ['user id', 'ExponentPushToken[fresh]', '   ', 'merchant-1'],
    ['merchant id', 'ExponentPushToken[fresh]', 'user-1', '\n\t'],
  ])('returns false and skips upsert when %s is blank', async (_field, token, userId, merchantId) => {
    const saved = await savePushTokenToServer(token, userId, merchantId);

    expect(saved).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Refusing to save push token: empty token/userId/merchantId'
    );
  });
});

describe('handleNotificationResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('navigates token-ready notifications to utility history', () => {
    const navigate = jest.fn();
    const data = {
      type: 'vtu_token_ready',
      utilityType: 'power',
    };
    getStorefrontNotificationNavigationTarget.mockReturnValue({
      screen: 'utility-history',
      params: { type: 'power' },
    });

    handleNotificationResponse(
      {
        notification: {
          request: {
            content: {
              data,
            },
          },
        },
      } as unknown as Parameters<typeof handleNotificationResponse>[0],
      navigate
    );

    expect(navigate).toHaveBeenCalledWith('utility-history', {
      type: 'power',
    });
    expect(getStorefrontNotificationNavigationTarget).toHaveBeenCalledWith(
      data
    );
  });

  it('does not navigate when notification payload has no target', () => {
    const navigate = jest.fn();
    getStorefrontNotificationNavigationTarget.mockReturnValue(null);

    handleNotificationResponse(
      {
        notification: {
          request: {
            content: {
              data: { type: 'unknown_type' },
            },
          },
        },
      } as unknown as Parameters<typeof handleNotificationResponse>[0],
      navigate
    );

    expect(navigate).not.toHaveBeenCalled();
  });
});
