import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { BNPLCheckoutScreen } from '@/components/bnpl-checkout/BNPLCheckoutScreen';

const mockClearCart = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();
let mockRouteParams: Record<string, string> = {};
let mockStackOptions:
  | {
      headerLeft?: () => ReactNode;
    }
  | undefined;
let mockWebViewProps: Record<string, unknown> | undefined;
const mockControllerOverride = jest.fn();
const mockUseCameraPermission = jest.fn();
let mockCameraPermissionState: {
  canAskAgain: boolean;
  retry: () => void;
  status: 'checking' | 'denied' | 'granted';
};

jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ options }: { options?: { headerLeft?: () => ReactNode } }) => {
      mockStackOptions = options;
      return null;
    },
  },
  router: {
    back: mockRouterBack,
    replace: mockRouterReplace,
  },
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('react-native-webview', () => ({
  WebView: () => null,
}));

jest.mock('./BNPLCheckoutWebView', () => ({
  BNPLCheckoutWebView: (props: Record<string, unknown>) => {
    mockWebViewProps = props;
    return null;
  },
}));

jest.mock('./use-bnpl-checkout-controller', () => ({
  useBNPLCheckoutController: (input: unknown) => mockControllerOverride(input),
}));

jest.mock('./use-camera-permission', () => ({
  useCameraPermission: (enabled: boolean) => {
    mockUseCameraPermission(enabled);
    return mockCameraPermissionState;
  },
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

function createCheckoutControllerMock(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    amount: '25000',
    bnplUrl: 'https://usebaci.com/api/checkout/bnpl/order-123',
    currentUrl: 'https://usebaci.com/api/checkout/bnpl/order-123',
    errorMessage: null,
    gatewayName: 'Credit Direct',
    handleClose: jest.fn(),
    handleLoadEnd: jest.fn(),
    handleLoadStart: jest.fn(),
    handleNavigationChange: jest.fn(),
    handleOpenWindow: jest.fn(),
    handleRetry: jest.fn(),
    handleShouldStartLoadWithRequest: jest.fn(),
    handleWebViewError: jest.fn(),
    handleWebViewHttpError: jest.fn(),
    handleWebViewMessage: jest.fn(),
    status: 'ready',
    validatedParams: { isValid: true },
    webViewRef: { current: null },
    ...overrides,
  };
}

describe('BNPLCheckoutScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockControllerOverride.mockReset();
    mockControllerOverride.mockReturnValue(
      createCheckoutControllerMock({
        status: 'error',
        validatedParams: {
          error: 'Missing checkout parameters',
          isValid: false,
        },
      })
    );
    mockRouteParams = {};
    mockStackOptions = undefined;
    mockWebViewProps = undefined;
    mockCameraPermissionState = {
      canAskAgain: true,
      retry: jest.fn(),
      status: 'granted',
    };
  });

  it('renders invalid checkout state for missing required params', () => {
    render(<BNPLCheckoutScreen />);

    expect(screen.getByText('Invalid Checkout')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go back' })).toBeTruthy();
  });

  it('labels the icon-only close button for assistive technology', () => {
    mockRouteParams = {
      gateway: 'credit_direct',
      orderId: 'order-123',
    };
    mockControllerOverride.mockReturnValueOnce(createCheckoutControllerMock());

    render(<BNPLCheckoutScreen />);
    const HeaderLeft = mockStackOptions?.headerLeft;
    expect(HeaderLeft).toBeDefined();
    if (!HeaderLeft) {
      throw new Error('Expected the BNPL header left renderer to be set');
    }

    render(HeaderLeft() as ReactElement);

    expect(screen.getByRole('button', { name: 'Close checkout' })).toBeTruthy();
  });

  it('forwards WebView success and error handlers unchanged', () => {
    mockRouteParams = {
      gateway: 'credit_direct',
      orderId: 'order-123',
    };
    const handleNavigationChange = jest.fn();
    const handleShouldStartLoadWithRequest = jest.fn();
    const handleWebViewError = jest.fn();
    const handleWebViewHttpError = jest.fn();

    mockControllerOverride.mockReturnValueOnce(
      createCheckoutControllerMock({
        handleNavigationChange,
        handleShouldStartLoadWithRequest,
        handleWebViewError,
        handleWebViewHttpError,
      })
    );

    render(<BNPLCheckoutScreen />);

    expect(mockWebViewProps?.onNavigationStateChange).toBe(
      handleNavigationChange
    );
    expect(mockWebViewProps?.onShouldStartLoadWithRequest).toBe(
      handleShouldStartLoadWithRequest
    );
    expect(mockWebViewProps?.onError).toBe(handleWebViewError);
    expect(mockWebViewProps?.onHttpError).toBe(handleWebViewHttpError);
  });

  it('passes media capture allowance only after Credit Direct camera permission is granted', () => {
    mockRouteParams = {
      gateway: 'credit_direct',
      orderId: 'order-123',
    };
    mockControllerOverride.mockReturnValueOnce(
      createCheckoutControllerMock({
        validatedParams: {
          data: { gateway: 'credit_direct' },
          isValid: true,
        },
      })
    );

    render(<BNPLCheckoutScreen />);

    expect(mockUseCameraPermission).toHaveBeenCalledWith(true);
    expect(mockWebViewProps?.allowsMediaCapture).toBe(true);
  });

  it('keeps media capture disabled for non-Credit Direct gateways', () => {
    mockRouteParams = {
      gateway: 'klump',
      orderId: 'order-123',
    };
    mockControllerOverride.mockReturnValueOnce(
      createCheckoutControllerMock({
        validatedParams: {
          data: { gateway: 'klump' },
          isValid: true,
        },
      })
    );

    render(<BNPLCheckoutScreen />);

    expect(mockUseCameraPermission).toHaveBeenCalledWith(false);
    expect(mockWebViewProps?.allowsMediaCapture).toBe(false);
  });

  it('shows terminal checkout errors before camera permission states', () => {
    const handleRetry = jest.fn();
    mockCameraPermissionState = {
      canAskAgain: false,
      retry: jest.fn(),
      status: 'denied',
    };
    mockRouteParams = {
      gateway: 'credit_direct',
      orderId: 'order-123',
    };
    mockControllerOverride.mockReturnValueOnce(
      createCheckoutControllerMock({
        errorMessage: 'Checkout session expired',
        handleRetry,
        status: 'error',
        validatedParams: {
          data: { gateway: 'credit_direct' },
          isValid: true,
        },
      })
    );

    render(<BNPLCheckoutScreen />);

    expect(screen.getByText('Checkout session expired')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Try payment again' }));

    expect(handleRetry).toHaveBeenCalledTimes(1);
    expect(mockWebViewProps).toBeUndefined();
  });

  it('uses checkout close handling from the camera permission error state', () => {
    const handleClose = jest.fn();
    const retryCameraPermission = jest.fn();
    mockCameraPermissionState = {
      canAskAgain: true,
      retry: retryCameraPermission,
      status: 'denied',
    };
    mockRouteParams = {
      gateway: 'credit_direct',
      orderId: 'order-123',
    };
    mockControllerOverride.mockReturnValueOnce(
      createCheckoutControllerMock({
        handleClose,
        validatedParams: {
          data: { gateway: 'credit_direct' },
          isValid: true,
        },
      })
    );

    render(<BNPLCheckoutScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Try payment again' }));
    fireEvent.press(screen.getByRole('button', { name: 'Go back' }));

    expect(retryCameraPermission).toHaveBeenCalledTimes(1);
    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(mockRouterBack).not.toHaveBeenCalled();
  });
});
