import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { COLORS } from '@/constants/theme';
import { ShipmentIdentifierScanner } from './ShipmentIdentifierScanner';

const cameraState = vi.hoisted(() => ({
  requestPermission: vi.fn(),
  scanData: ' sn-ab-123 ',
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
      onClick={() => onBarcodeScanned?.({ data: cameraState.scanData })}
      type="button"
    >
      {children}
      <span>Tap to scan</span>
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
    cameraState.scanData = ' sn-ab-123 ';

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

  it('shows a permission fallback when camera access is denied', async () => {
    cameraState.requestPermission.mockResolvedValue({ status: 'denied' });

    render(
      <ShipmentIdentifierScanner
        colors={COLORS}
        field="imei"
        onClose={vi.fn()}
        onScanned={vi.fn()}
        visible={true}
      />
    );

    expect(
      await screen.findByText(
        'Camera permission is required to scan identifiers.'
      )
    ).toBeInTheDocument();
  });

  it('alerts when a scanned code has no valid identifier', async () => {
    const onScanned = vi.fn();
    cameraState.requestPermission.mockResolvedValue({ status: 'granted' });
    cameraState.scanData = 'not-an-imei';

    render(
      <ShipmentIdentifierScanner
        colors={COLORS}
        field="imei"
        onClose={vi.fn()}
        onScanned={onScanned}
        visible={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Mock camera scanner')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Mock camera scanner'));
    fireEvent.click(screen.getByLabelText('Mock camera scanner'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Scan Failed',
      'No valid identifier was found in this code.'
    );
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(onScanned).not.toHaveBeenCalled();
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
