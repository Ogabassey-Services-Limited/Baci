/**
 * Order Success Screen
 * Shown after successful order placement
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { BRAND } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function OrderSuccessScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleContinueShopping = () => {
    router.replace('/(tabs)');
  };

  const handleViewOrders = () => {
    router.replace('/orders');
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />

      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          {/* Success Icon */}
          <Animated.View
            style={[
              styles.iconContainer,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: BRAND.primaryLight }]}>
              <View style={[styles.iconInner, { backgroundColor: '#10B981' }]}>
                <Ionicons name="checkmark" size={48} color="#FFFFFF" />
              </View>
            </View>
          </Animated.View>

          {/* Success Message */}
          <Text style={[styles.title, { color: colors.text }]}>
            Order Placed!
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Thank you for your order. We'll send you a confirmation email with
            your order details shortly.
          </Text>

          {/* Order Info */}
          <View style={[styles.orderInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.orderRow}>
              <Ionicons name="receipt-outline" size={20} color={BRAND.primary} />
              <Text style={[styles.orderLabel, { color: colors.textSecondary }]}>
                Order Number
              </Text>
              <Text style={[styles.orderValue, { color: colors.text }]}>
                #OGB-{Math.random().toString(36).substr(2, 8).toUpperCase()}
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.orderRow}>
              <Ionicons name="time-outline" size={20} color={BRAND.primary} />
              <Text style={[styles.orderLabel, { color: colors.textSecondary }]}>
                Estimated Delivery
              </Text>
              <Text style={[styles.orderValue, { color: colors.text }]}>
                2-4 Business Days
              </Text>
            </View>
          </View>

          {/* What's Next */}
          <View style={styles.nextSteps}>
            <Text style={[styles.nextTitle, { color: colors.text }]}>
              What happens next?
            </Text>

            <View style={styles.stepItem}>
              <View style={[styles.stepNumber, { backgroundColor: BRAND.primaryLight }]}>
                <Text style={[styles.stepNumberText, { color: BRAND.primary }]}>1</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                You'll receive an order confirmation email
              </Text>
            </View>

            <View style={styles.stepItem}>
              <View style={[styles.stepNumber, { backgroundColor: BRAND.primaryLight }]}>
                <Text style={[styles.stepNumberText, { color: BRAND.primary }]}>2</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                We'll prepare and ship your order
              </Text>
            </View>

            <View style={styles.stepItem}>
              <View style={[styles.stepNumber, { backgroundColor: BRAND.primaryLight }]}>
                <Text style={[styles.stepNumberText, { color: BRAND.primary }]}>3</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                Track your delivery in real-time
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom Actions */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: BRAND.primary }]}
            onPress={handleContinueShopping}
          >
            <Text style={styles.primaryButtonText}>Continue Shopping</Text>
          </Pressable>

          <Pressable
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={handleViewOrders}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              View My Orders
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    maxWidth: 300,
  },
  orderInfo: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 32,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderLabel: {
    flex: 1,
    fontSize: 14,
  },
  orderValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  nextSteps: {
    width: '100%',
  },
  nextTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: '600',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
