import Ionicons from '@react-native-vector-icons/ionicons';
import { Camera, CameraView } from 'expo-camera';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { styles } from './ShipmentFlowSheet.styles';

function normalizeScannedIdentifier(
  field: 'imei' | 'serialNumber',
  value: string
): string {
  if (field === 'imei') {
    return value.replace(/\D/g, '').slice(0, 15);
  }

  return value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

interface ShipmentIdentifierScannerProps {
  colors: ThemeColors;
  field: 'imei' | 'serialNumber';
  onClose: () => void;
  onScanned: (value: string) => void;
  visible: boolean;
}

export function ShipmentIdentifierScanner({
  colors,
  field,
  onClose,
  onScanned,
  visible,
}: ShipmentIdentifierScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!visible) {
      setScanned(false);
      return;
    }

    Camera.requestCameraPermissionsAsync().then(({ status }) => {
      setHasPermission(status === 'granted');
    });
  }, [visible]);

  if (!visible) {
    return null;
  }

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) {
      return;
    }

    const normalizedValue = normalizeScannedIdentifier(field, data);
    if (!normalizedValue) {
      Alert.alert('Scan Failed', 'No valid identifier was found in this code.');
      return;
    }

    setScanned(true);
    onScanned(normalizedValue);
  };

  return (
    <View
      style={[
        styles.identifierScannerOverlay,
        { backgroundColor: colors.background },
      ]}
    >
      {hasPermission === true ? (
        <CameraView
          barcodeScannerSettings={{
            barcodeTypes: [
              'qr',
              'ean13',
              'ean8',
              'upc_a',
              'upc_e',
              'code128',
              'code39',
              'code93',
              'codabar',
            ],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          style={styles.identifierScannerCamera}
        >
          <View style={styles.identifierScannerShade}>
            <View style={styles.identifierScannerFrame} />
            <Text style={styles.identifierScannerText}>
              Scan {field === 'imei' ? 'IMEI' : 'serial number'}
            </Text>
          </View>
        </CameraView>
      ) : (
        <View style={styles.identifierScannerFallback}>
          <Ionicons
            color={colors.textSecondary}
            name="camera-outline"
            size={42}
          />
          <Text
            style={[styles.identifierScannerMessage, { color: colors.text }]}
          >
            {hasPermission === false
              ? 'Camera permission is required to scan identifiers.'
              : 'Requesting camera permission...'}
          </Text>
        </View>
      )}

      <Pressable
        accessibilityLabel="Close identifier scanner"
        accessibilityRole="button"
        onPress={onClose}
        style={[
          styles.identifierScannerClose,
          { backgroundColor: colors.cardHover },
        ]}
      >
        <Ionicons color={colors.text} name="close" size={24} />
      </Pressable>
    </View>
  );
}
