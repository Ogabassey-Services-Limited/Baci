import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { COLORS } from '@/constants/theme';
import { ShipmentIdentifierScanner } from './ShipmentIdentifierScanner';

const cameraState = vi.hoisted(() => ({
  requestPermission: vi.fn(),
}));

vi.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: cameraState.requestPermission,
  },
  CameraView: ({
    children,
    onBarcodeScanned,
  }: {
    children?: ReactNode;
    onBarcodeScanned?: (event: { data: string }) => void;
  }) => (
    <button
      aria-label="Mock camera scanner"
      onClick={() => onBarcodeScanned?.({ data: ' sn-ab-123 ' })}
      type="button"
    >
      {children}
    </button>
  ),
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button aria-label={accessibilityLabel} onClick={onPress} type="button">
      {children}
    </button>
  ),
  StyleSheet: {
    absoluteFill: {},
    create: (styles: unknown) => styles,
    hairlineWidth: 1,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('ShipmentIdentifierScanner', () => {
  it('normalizes scanned serial numbers before returning them', async () => {
    const onScanned = vi.fn();
    cameraState.requestPermission.mockResolvedValue({ status: 'granted' });

    render(
      <ShipmentIdentifierScanner
        colors={COLORS}
        field="serialNumber"
        onClose={vi.fn()}
        onScanned={onScanned}
        visible={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Mock camera scanner')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Mock camera scanner'));

    expect(onScanned).toHaveBeenCalledWith('SN-AB-123');
  });

  it('does not render while hidden', () => {
    render(
      <ShipmentIdentifierScanner
        colors={COLORS}
        field="imei"
        onClose={vi.fn()}
        onScanned={vi.fn()}
        visible={false}
      />
    );

    expect(screen.queryByText('Requesting camera permission...')).toBeNull();
  });
});
