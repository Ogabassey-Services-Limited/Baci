/**
 * Barcode Scanner Screen
 * Quick inventory lookup and updates
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useMerchant } from '@/hooks/useMerchant';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function ScanScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  const colors = {
    background: isDark ? '#0F172A' : '#F8FAFC',
    text: isDark ? '#F8FAFC' : '#0F172A',
  };

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const { merchant } = useMerchant();

  const handleBarcodeScanned = async ({
    type,
    data,
  }: {
    type: string;
    data: string;
  }) => {
    setScanned(true);

    try {
      // Query product by barcode/sku
      const { data: product, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('merchant_id', merchant?.id)
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
                router.push({
                  pathname: '/product/new',
                  params: { sku: data },
                } as any),
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
          <Ionicons name="camera-outline" size={64} color="#EF4444" />
          <Text style={[styles.message, { color: colors.text }]}>
            Camera permission denied
          </Text>
          <Text style={[styles.subMessage, { color: colors.text }]}>
            Please enable camera access in settings
          </Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
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
    backgroundColor: '#000000',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  message: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  subMessage: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  backButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
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
    paddingHorizontal: 32,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
