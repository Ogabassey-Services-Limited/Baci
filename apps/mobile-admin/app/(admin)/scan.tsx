/**
 * Barcode Scanner Screen
 * Quick inventory lookup and updates
 */

import { Ionicons } from '@expo/vector-icons';
import { Camera, CameraView } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

export default function ScanScreen() {
  const { colors } = useTheme();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const { merchant } = useMerchant();

  const handleBarcodeScanned = async ({
    type: _type,
    data,
  }: {
    type: string;
    data: string;
  }) => {
    setScanned(true);

    if (!merchant?.id) {
      Alert.alert('Error', 'Merchant not loaded. Please try again.');
      setScanned(false);
      return;
    }

    try {
      // Query product by barcode/sku
      const { data: product, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('merchant_id', merchant.id)
        .eq('sku', data)
        .single();

      if (error || !product) {
        Alert.alert(
          'Product Not Found',
          `No product found with barcode: ${data}`,
          [
            {
              text: 'Scan Again',
              onPress: () => setScanned(false),
            },
            {
              text: 'Add New Product',
              onPress: () =>
                router.push(`/product/new?sku=${encodeURIComponent(data)}`),
            },
          ]
        );
        return;
      }

      Alert.alert(
        'Product Found',
        `Product: ${product.name}\nBarcode: ${data}`,
        [
          {
            text: 'View Product',
            onPress: () => {
              router.push(`/product/${product.id}`);
            },
          },
          {
            text: 'Scan Again',
            onPress: () => setScanned(false),
          },
        ]
      );
    } catch (err) {
      console.error('Error scanning barcode:', err);
      Alert.alert('Error', 'Failed to lookup product. Please try again.');
      setScanned(false);
    }
  };

  if (hasPermission === null) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.centerContent}>
          <Text style={[styles.message, { color: colors.text }]}>
            Requesting camera permission...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.centerContent}>
          <Ionicons name="camera-outline" size={64} color={colors.error} />
          <Text style={[styles.message, { color: colors.text }]}>
            Camera permission denied
          </Text>
          <Text style={[styles.subMessage, { color: colors.text }]}>
            Please enable camera access in settings
          </Text>
          <Pressable
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.backButtonText, { color: colors.textOnPrimary }]}>
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <CameraView
        style={styles.camera}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
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
      >
        <View style={styles.overlay}>
          {/* Scanner Frame */}
          <View style={styles.scannerFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>

          {/* Instructions */}
          <View style={styles.instructions}>
            <Text style={styles.instructionText}>
              {scanned ? 'Processing...' : 'Align barcode within frame'}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: '#1E293B' }]}
              onPress={() => router.back()}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Cancel</Text>
            </Pressable>

            {scanned && (
              <Pressable
                style={[styles.actionButton, { backgroundColor: '#3B82F6' }]}
                onPress={() => setScanned(false)}
              >
                <Ionicons name="refresh" size={24} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Scan Again</Text>
              </Pressable>
            )}
          </View>
        </View>
      </CameraView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Keep #000 for full-screen camera compatibility
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING['3xl'],
    gap: SPACING.lg,
  },
  message: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    textAlign: 'center',
  },
  subMessage: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    opacity: 0.7,
  },
  backButton: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING['2xl'],
    borderRadius: RADIUS.md,
  },
  backButtonText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'space-between',
    paddingVertical: 48,
  },
  scannerFrame: {
    alignSelf: 'center',
    width: 280,
    height: 280,
    marginTop: 80,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#FFFFFF',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  instructions: {
    alignItems: 'center',
    paddingHorizontal: SPACING['3xl'],
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING['3xl'],
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
