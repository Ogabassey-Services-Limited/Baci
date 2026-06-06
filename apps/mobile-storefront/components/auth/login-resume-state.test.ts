import * as SecureStore from 'expo-secure-store';
import {
  clearAuthLoginResumeState,
  getAuthLoginResumeState,
  saveAuthLoginResumeState,
} from './login-resume-state';

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    warn: jest.fn(),
  }),
}));

const mockDeleteItemAsync = SecureStore.deleteItemAsync as jest.MockedFunction<
  typeof SecureStore.deleteItemAsync
>;
const mockGetItemAsync = SecureStore.getItemAsync as jest.MockedFunction<
  typeof SecureStore.getItemAsync
>;
const mockSetItemAsync = SecureStore.setItemAsync as jest.MockedFunction<
  typeof SecureStore.setItemAsync
>;

describe('login resume state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    mockDeleteItemAsync.mockResolvedValue(undefined);
    mockGetItemAsync.mockResolvedValue(null);
    mockSetItemAsync.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores pending OTP login state with a timestamp', async () => {
    await saveAuthLoginResumeState({
      email: 'shopper@example.com',
      returnTo: '/checkout',
      step: 'otp',
    });

    expect(mockSetItemAsync).toHaveBeenCalledTimes(1);
    const [, serializedState] = mockSetItemAsync.mock.calls[0];
    expect(JSON.parse(serializedState)).toEqual({
      email: 'shopper@example.com',
      returnTo: '/checkout',
      savedAt: 1_000_000,
      step: 'otp',
    });
  });

  it('returns pending OTP state only for the expected return target', async () => {
    mockGetItemAsync.mockResolvedValueOnce(
      JSON.stringify({
        email: 'shopper@example.com',
        returnTo: '/checkout',
        savedAt: 1_000_000,
        step: 'otp',
      })
    );

    await expect(getAuthLoginResumeState('/checkout')).resolves.toEqual({
      email: 'shopper@example.com',
      returnTo: '/checkout',
      step: 'otp',
    });

    mockGetItemAsync.mockResolvedValueOnce(
      JSON.stringify({
        email: 'shopper@example.com',
        returnTo: '/checkout',
        savedAt: 1_000_000,
        step: 'otp',
      })
    );

    await expect(getAuthLoginResumeState('/cart')).resolves.toBeNull();
  });

  it('ignores malformed or stale pending OTP state', async () => {
    mockGetItemAsync.mockResolvedValueOnce('not json');
    await expect(getAuthLoginResumeState('/checkout')).resolves.toBeNull();

    mockGetItemAsync.mockResolvedValueOnce(
      JSON.stringify({
        email: 'shopper@example.com',
        returnTo: '/checkout',
        savedAt: 1,
        step: 'otp',
      })
    );
    await expect(getAuthLoginResumeState('/checkout')).resolves.toBeNull();
  });

  it('clears pending OTP login state', async () => {
    await clearAuthLoginResumeState();

    expect(mockDeleteItemAsync).toHaveBeenCalledTimes(1);
  });
});
