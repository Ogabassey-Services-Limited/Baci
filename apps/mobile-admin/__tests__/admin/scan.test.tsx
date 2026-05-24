/**
 * Tests for ScanScreen component
 */

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockRouterBack = vi.fn();
const mockRouterPush = vi.fn();

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Alert: { alert: vi.fn() },
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
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('expo-router', () => ({
  router: {
    back: () => mockRouterBack(),
    push: (path: string) => mockRouterPush(path),
  },
}));

let mockPermissionStatus = 'granted';
vi.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: () =>
      Promise.resolve({ status: mockPermissionStatus }),
  },
  CameraView: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="camera-view">{children}</div>
  ),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="safe-area-view">{children}</div>
  ),
}));

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: ({ name, size }: { name: string; size: number }) => (
    <span data-testid={`icon-${name}`} data-size={size} />
  ),

  default: ({ name, size }: { name: string; size: number }) => (
    <span data-testid={`icon-${name}`} data-size={size} />
  ),
  __esModule: true,
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

import ScanScreen from '../../app/(admin)/scan';

describe('ScanScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissionStatus = 'granted';
  });

  describe('permission states', () => {
    it('renders requesting permission message initially', () => {
      // Camera permission is null before the async effect resolves
      mockPermissionStatus = 'granted';
      render(<ScanScreen />);
      expect(screen.getByText('Requesting camera permission...')).toBeDefined();
    });

    it('renders permission denied state with Go Back button', async () => {
      mockPermissionStatus = 'denied';
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
      mockPermissionStatus = 'granted';
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
});
