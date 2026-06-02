import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { BNPL_UNTRUSTED_POPUP_MESSAGE } from './bnpl-checkout.helpers';
import { useBNPLCheckoutController } from './use-bnpl-checkout-controller';

const mockClearCart = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();
let mockRouteParams: Record<string, string> = {
  gateway: 'credit_direct',
  orderId: 'order-123',
};

const renderControllerHook = () =>
  renderHook(() =>
    useBNPLCheckoutController({
      apiBaseUrl: 'https://usebaci.com',
      params: mockRouteParams,
    })
  );

jest.mock('expo-router', () => ({
  router: {
    back: mockRouterBack,
    replace: mockRouterReplace,
  },
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/lib/api-url', () => ({
  resolveApiBaseUrl: () => 'https://usebaci.com',
}));

jest.mock('@/stores/cart-store', () => ({
  useCartStore: (selector: (state: { clearCart: () => void }) => unknown) =>
    selector({ clearCart: mockClearCart }),
}));

describe('useBNPLCheckoutController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {
      gateway: 'credit_direct',
      orderId: 'order-123',
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the pending load timeout through rerenders and clears it on unmount', () => {
    jest.useFakeTimers();
    const { result, rerender, unmount } = renderControllerHook();

    act(() => {
      result.current.handleLoadStart();
    });
    expect(jest.getTimerCount()).toBe(1);

    rerender({});
    expect(jest.getTimerCount()).toBe(1);

    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('surfaces untrusted auxiliary windows as checkout errors', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { result } = renderControllerHook();

    act(() => {
      result.current.handleOpenWindow({
        nativeEvent: {
          targetUrl: 'https://evil.example/popup',
        },
      });
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe(BNPL_UNTRUSTED_POPUP_MESSAGE);
  });
});
