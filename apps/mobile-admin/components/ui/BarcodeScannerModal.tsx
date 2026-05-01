import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface BarcodeScannerModalProps {
  isVisible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  title?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isVisible,
  onClose,
  onScan,
  title = 'Scan Barcode',
}) => {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isVisible && (!permission || !permission.granted)) {
      requestPermission();
    }
  }, [isVisible, permission, requestPermission]);

  // Clear timeout on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    // Provide haptic feedback for success
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onScan(data);

    // Reset scanned state after a short delay to prevent multi-scans but allow subsequent ones
    scanTimeoutRef.current = setTimeout(() => {
      setScanned(false);
    }, 1500);
  };

  if (!permission) {
    return null;
  }

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={isVisible}
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header} accessibilityRole="header">
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
            accessibilityHint="Closes the camera view"
          >
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
        </View>

        {!permission.granted ? (
          <View style={styles.center}>
            <Ionicons
              name="camera-outline"
              size={64}
              color={colors.textMuted}
              style={{ marginBottom: 20 }}
            />
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              Camera permission is required to scan barcodes.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.7 },
              ]}
              onPress={requestPermission}
              accessibilityRole="button"
              accessibilityLabel="Grant camera permission"
              accessibilityHint="Allows the app to use the camera for scanning"
            >
              <Text style={styles.buttonText}>Grant Permission</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              accessibilityLabel="Barcode scanner camera"
              accessibilityHint="Align barcode within the frame to scan"
              barcodeScannerSettings={{
                barcodeTypes: [
                  'qr',
                  'ean13',
                  'ean8',
                  'code128',
                  'code39',
                  'upc_a',
                  'upc_e',
                ],
              }}
            >
              <View style={styles.overlay}>
                <View
                  style={[styles.scannerBox, { borderColor: colors.primary }]}
                >
                  <View
                    style={[
                      styles.corner,
                      styles.topLeft,
                      { borderColor: colors.primary },
                    ]}
                  />
                  <View
                    style={[
                      styles.corner,
                      styles.topRight,
                      { borderColor: colors.primary },
                    ]}
                  />
                  <View
                    style={[
                      styles.corner,
                      styles.bottomLeft,
                      { borderColor: colors.primary },
                    ]}
                  />
                  <View
                    style={[
                      styles.corner,
                      styles.bottomRight,
                      { borderColor: colors.primary },
                    ]}
                  />

                  {/* Subtle scanning animation line placeholder */}
                  <View
                    style={[
                      styles.scanLine,
                      { backgroundColor: colors.primary },
                    ]}
                  />
                </View>
                <Text style={styles.helperText}>
                  Align barcode within the frame
                </Text>
              </View>
            </CameraView>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: 60,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  message: {
    textAlign: 'center',
    marginBottom: SPACING.lg,
    fontSize: 16,
    lineHeight: 24,
  },
  button: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerBox: {
    width: 280,
    height: 180,
    borderWidth: 0,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanLine: {
    position: 'absolute',
    width: '100%',
    height: 2,
    top: '50%',
    opacity: 0.5,
  },
  helperText: {
    color: '#FFF',
    marginTop: 30,
    fontSize: 15,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
});
