/**
 * Order Success Screen
 * Shown after successful order placement
 */

import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PermissionModal } from '@/components/ui/PermissionModal';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { usePermissionBooster } from '@/hooks/use-permission-booster';
import { BACI_GOOGLE_REVIEW_URL } from '@/lib/post-purchase-actions';
import { useAuthStore } from '@/stores/auth-store';

export default function OrderSuccessScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const { orderNumber, reference, trackingToken } =
    useLocalSearchParams<Record<string, string>>();
  const customer = useAuthStore((s) => s.customer);

  const { requestPermission, triggerSystemPrompt, markDenied } =
    usePermissionBooster();
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();

    // Check for notification permissions (Soft Ask)
    // Small delay to let the success animation play (better UX)
    const timerId = setTimeout(async () => {
      const result = await requestPermission('notifications');
      if (result === 'soft-ask-needed') {
        setShowPermissionModal(true);
      }
    }, 1500);

    return () => {
      clearTimeout(timerId);
    };
  }, [scaleAnim, requestPermission]);

  const handlePermissionGrant = async () => {
    setShowPermissionModal(false);
    await triggerSystemPrompt('notifications');
  };

  const handlePermissionDeny = () => {
    setShowPermissionModal(false);
    markDenied('notifications');
  };

  const handleContinueShopping = () => {
    router.replace('/(tabs)');
  };

  const handleViewOrders = () => {
    if (!customer && trackingToken) {
      router.replace({
        pathname: '/track-order',
        params: { trackingToken },
      });
    } else {
      router.replace('/orders');
    }
  };

  const handleLeaveGoogleReview = async () => {
    try {
      await Linking.openURL(BACI_GOOGLE_REVIEW_URL);
    } catch {
      Alert.alert(
        'Unable to open review link',
        'Please try again in a browser later.'
      );
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />

      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.content}>
          {/* Success Icon */}
          <Animated.View
            style={[
              styles.iconContainer,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: BRAND.primaryLight },
              ]}
            >
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
          <View
            style={[
              styles.orderInfo,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.orderRow}>
              <Ionicons
                name="receipt-outline"
                size={20}
                color={BRAND.primary}
              />
              <Text
                style={[styles.orderLabel, { color: colors.textSecondary }]}
              >
                Order Number
              </Text>
              <Text style={[styles.orderValue, { color: colors.text }]}>
                #{orderNumber || 'Processing...'}
              </Text>
            </View>

            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />

            <View style={styles.orderRow}>
              <Ionicons name="time-outline" size={20} color={BRAND.primary} />
              <Text
                style={[styles.orderLabel, { color: colors.textSecondary }]}
              >
                Estimated Delivery
              </Text>
              <Text style={[styles.orderValue, { color: colors.text }]}>
                2-4 Business Days
              </Text>
            </View>

            {reference ? (
              <>
                <View
                  style={[styles.divider, { backgroundColor: colors.border }]}
                />
                <View style={styles.orderRow}>
                  <Ionicons
                    name="card-outline"
                    size={20}
                    color={BRAND.primary}
                  />
                  <Text
                    style={[styles.orderLabel, { color: colors.textSecondary }]}
                  >
                    Payment Ref
                  </Text>
                  <Text style={[styles.orderValue, { color: colors.text }]}>
                    {reference}
                  </Text>
                </View>
              </>
            ) : null}
          </View>

          {/* What's Next */}
          <View style={styles.nextSteps}>
            <Text style={[styles.nextTitle, { color: colors.text }]}>
              What happens next?
            </Text>

            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepNumber,
                  { backgroundColor: BRAND.primaryLight },
                ]}
              >
                <Text style={[styles.stepNumberText, { color: BRAND.primary }]}>
                  1
                </Text>
              </View>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                You'll receive an order confirmation email
              </Text>
            </View>

            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepNumber,
                  { backgroundColor: BRAND.primaryLight },
                ]}
              >
                <Text style={[styles.stepNumberText, { color: BRAND.primary }]}>
                  2
                </Text>
              </View>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                We'll prepare and ship your order
              </Text>
            </View>

            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepNumber,
                  { backgroundColor: BRAND.primaryLight },
                ]}
              >
                <Text style={[styles.stepNumberText, { color: BRAND.primary }]}>
                  3
                </Text>
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

          <Pressable
            style={[styles.reviewButton, { borderColor: colors.border }]}
            onPress={handleLeaveGoogleReview}
          >
            <Ionicons name="logo-google" size={18} color={colors.text} />
            <Text style={[styles.reviewButtonText, { color: colors.text }]}>
              Leave a Google Review
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <PermissionModal
        visible={showPermissionModal}
        type="notifications"
        onGrant={handlePermissionGrant}
        onDeny={handlePermissionDeny}
      />
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
  reviewButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
  },
  reviewButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
