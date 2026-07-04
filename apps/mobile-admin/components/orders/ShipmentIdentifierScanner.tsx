import Ionicons from '@react-native-vector-icons/ionicons';
import { Camera, CameraView } from 'expo-camera';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { normalizeFulfillmentIdentifier } from '@/lib/order-fulfillment-identifiers';
import { identifierStyles } from './ShipmentFlowIdentifier.styles';

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

    let isCurrent = true;
    setHasPermission(null);
    Camera.requestCameraPermissionsAsync()
      .then(({ status }) => {
        if (isCurrent) {
          setHasPermission(status === 'granted');
        }
      })
      .catch(() => {
        if (isCurrent) {
          setHasPermission(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [visible]);

  if (!visible) {
    return null;
  }

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) {
      return;
    }

    const normalizedValue = normalizeFulfillmentIdentifier(field, data);
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
        identifierStyles.scannerOverlay,
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
          style={identifierStyles.scannerCamera}
        >
          <View style={identifierStyles.scannerShade}>
            <View style={identifierStyles.scannerFrame} />
            <Text style={identifierStyles.scannerText}>
              Scan {field === 'imei' ? 'IMEI' : 'serial number'}
            </Text>
          </View>
        </CameraView>
      ) : (
        <View style={identifierStyles.scannerFallback}>
          <Ionicons
            color={colors.textSecondary}
            name="camera-outline"
            size={42}
          />
          <Text
            style={[identifierStyles.scannerMessage, { color: colors.text }]}
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
          identifierStyles.scannerClose,
          { backgroundColor: colors.cardHover },
        ]}
      >
        <Ionicons color={colors.text} name="close" size={24} />
      </Pressable>
    </View>
  );
}
