/**
 * Tests for ScanScreen component
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  lastBarcodeHandler: undefined as
    | ((payload: BarcodeScanPayload) => Promise<void> | void)
    | undefined,
  requestCameraPermissionsAsync: vi.fn(),
  routerBack: vi.fn(),
  routerPush: vi.fn(),
}));
const mockAlert = mocks.alert;

type BarcodeScanPayload = {
  type: string;
  data: string;
};

type AlertButton = {
  onPress?: () => void;
};

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Alert: { alert: mocks.alert },
    Pressable: ({
      children,
      onPress,
      disabled,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      disabled?: boolean;
    }) =>
      React.createElement('button', { onClick: onPress, disabled }, children),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: unknown;
    }) => React.createElement('span', { style }, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('expo-router', () => ({
  router: {
    back: () => mocks.routerBack(),
    push: (path: string) => mocks.routerPush(path),
  },
}));

vi.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: () => mocks.requestCameraPermissionsAsync(),
  },
  CameraView: ({
    children,
    onBarcodeScanned,
  }: {
    children: React.ReactNode;
    onBarcodeScanned?: (payload: BarcodeScanPayload) => Promise<void> | void;
  }) => {
    mocks.lastBarcodeHandler = onBarcodeScanned;

    return <div data-testid="camera-view">{children}</div>;
  },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({
    children,
    ...props
  }: { children: React.ReactNode } & Record<string, unknown>) => (
    <div data-testid="safe-area-view" {...props}>
      {children}
    </div>
  ),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, size }: { name: string; size: number }) => (
    <span data-testid={`icon-${name}`} data-size={size} />
  ),
}));

const mockMerchant = { id: 'merchant-123' };
vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: mockMerchant }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#0D0D1A',
      text: '#FFFFFF',
      error: '#EF4444',
      primary: '#4A90D9',
      textOnPrimary: '#FFFFFF',
    },
    isDark: true,
  }),
}));

vi.mock('@/constants/theme', () => ({
  RADIUS: {
    md: 12,
  },
  SPACING: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 48,
  },
  TYPOGRAPHY: {
    fontFamily: {
      regular: 'Inter_400Regular',
      semiBold: 'Inter_600SemiBold',
      bold: 'Inter_700Bold',
    },
    size: {
      md: 14,
      lg: 16,
      xl: 18,
    },
  },
}));

const mockSupabaseSingle = vi.fn();
const mockSupabaseEq = vi.fn(() => ({ single: mockSupabaseSingle }));
const mockSupabaseSelect = vi.fn(() => ({
  eq: vi.fn(() => ({ eq: mockSupabaseEq })),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({ select: mockSupabaseSelect }),
  },
}));

// --- Tests ---

import ScanScreen from './scan';

async function triggerBarcodeScan(data: string) {
  const onBarcodeScanned = mocks.lastBarcodeHandler;

  if (!onBarcodeScanned) {
    throw new Error('Expected camera barcode handler to be registered');
  }

  await act(async () => {
    await onBarcodeScanned({ type: 'ean13', data });
  });
}

function pressLastAlertButton(index: number) {
  const buttons = mockAlert.mock.calls.at(-1)?.[2] as AlertButton[] | undefined;
  const onPress = buttons?.[index]?.onPress;

  if (!onPress) {
    throw new Error(`Expected alert button ${index} to exist`);
  }

  act(() => {
    onPress();
  });
}

describe('ScanScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lastBarcodeHandler = undefined;
    mocks.requestCameraPermissionsAsync.mockResolvedValue({
      status: 'granted',
    });
  });

  describe('permission states', () => {
    it('renders requesting permission message initially', () => {
      mocks.requestCameraPermissionsAsync.mockReturnValue(
        new Promise(() => void 0)
      );
      render(<ScanScreen />);
      expect(screen.getByText('Requesting camera permission...')).toBeDefined();
    });

    it('renders permission denied state with Go Back button', async () => {
      mocks.requestCameraPermissionsAsync.mockResolvedValue({
        status: 'denied',
      });
      render(<ScanScreen />);

      await waitFor(() => {
        expect(screen.getByText('Camera permission denied')).toBeDefined();
      });

      expect(
        screen.getByText('Please enable camera access in settings')
      ).toBeDefined();
      expect(screen.getByText('Go Back')).toBeDefined();
    });

    it('renders camera view when permission is granted', async () => {
      render(<ScanScreen />);

      await waitFor(() => {
        expect(screen.getByTestId('camera-view')).toBeDefined();
      });

      expect(screen.getByText('Align barcode within frame')).toBeDefined();
      expect(screen.getByText('Cancel')).toBeDefined();
    });
  });

  describe('camera overlay', () => {
    it('displays instruction text when not scanning', async () => {
      render(<ScanScreen />);

      await waitFor(() => {
        expect(screen.getByText('Align barcode within frame')).toBeDefined();
      });
    });

    it('renders Cancel button in camera overlay', async () => {
      render(<ScanScreen />);

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeDefined();
      });
    });
  });

  describe('scan results', () => {
    it('runs the add-product action from the product-not-found alert', async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      render(<ScanScreen />);

      await waitFor(() => {
        expect(screen.getByTestId('camera-view')).toBeDefined();
      });

      await triggerBarcodeScan('ABC 123');

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Product Not Found',
          'No product found with barcode: ABC 123',
          expect.any(Array)
        );
      });

      pressLastAlertButton(1);

      expect(mocks.routerPush).toHaveBeenCalledWith(
        '/product/new?sku=ABC%20123'
      );
    });

    it('runs the scan-again action from the product-found alert', async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: { id: 'product-1', name: 'Widget' },
        error: null,
      });

      render(<ScanScreen />);

      await waitFor(() => {
        expect(screen.getByTestId('camera-view')).toBeDefined();
      });

      await triggerBarcodeScan('SKU-123');

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Product Found',
          'Product: Widget\nBarcode: SKU-123',
          expect.any(Array)
        );
      });

      expect(screen.getByText('Processing...')).toBeDefined();

      pressLastAlertButton(1);

      await waitFor(() => {
        expect(screen.getByText('Align barcode within frame')).toBeDefined();
      });
    });
  });
});
