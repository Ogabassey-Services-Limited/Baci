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
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleLogo } from '@/components/icons/GoogleLogo';
import { SuccessIcon } from '@/components/icons/SuccessIcon';
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
  const { orderNumber, reference, trackingToken, paymentMethod } =
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

  const successTone =
    paymentMethod === 'invoice'
      ? {
          eyebrow: 'Invoice ready',
          subtitle:
            "We've prepared your invoice. Once payment is made, we'll confirm the order and start processing it.",
        }
      : paymentMethod === 'payforme'
        ? {
            eyebrow: 'Payment request ready',
            subtitle:
              "We've saved this order for later payment. Once it is settled, we'll confirm it and begin processing.",
          }
        : {
            eyebrow: 'Order confirmed',
            subtitle:
              "Thanks for your order. We'll send a confirmation email and keep you updated as it moves.",
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
        edges={['left', 'right']}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <SuccessIcon size={84} color="#10B981" />
            </View>

            <View
              style={[
                styles.eyebrowPill,
                {
                  backgroundColor:
                    colorScheme === 'dark'
                      ? 'rgba(217, 59, 48, 0.16)'
                      : 'rgba(217, 59, 48, 0.08)',
                },
              ]}
            >
              <Text style={styles.eyebrowText}>{successTone.eyebrow}</Text>
            </View>

            <Text style={[styles.title, { color: colors.text }]}>
              Order Placed!
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {successTone.subtitle}
            </Text>

            <View
              style={[
                styles.orderInfo,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.orderRow}>
                <Ionicons
                  name="receipt-outline"
                  size={18}
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
                <Ionicons name="time-outline" size={18} color={BRAND.primary} />
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
                      size={18}
                      color={BRAND.primary}
                    />
                    <Text
                      style={[
                        styles.orderLabel,
                        { color: colors.textSecondary },
                      ]}
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

            <View style={styles.nextSteps}>
              <Text style={[styles.nextTitle, { color: colors.text }]}>
                What happens next
              </Text>
              <View
                style={[
                  styles.nextStepCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.stepIconWrap}>
                  <Ionicons
                    name="receipt-outline"
                    size={18}
                    color={BRAND.primary}
                  />
                </View>
                <View style={styles.nextStepBody}>
                  <Text style={[styles.nextStepTitle, { color: colors.text }]}>
                    Receipt
                  </Text>
                  <Text
                    style={[
                      styles.nextStepText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Your receipt will be available for download after your order
                    has been shipped.
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.nextStepCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.stepIconWrap}>
                  <Ionicons
                    name="cube-outline"
                    size={18}
                    color={BRAND.primary}
                  />
                </View>
                <View style={styles.nextStepBody}>
                  <Text style={[styles.nextStepTitle, { color: colors.text }]}>
                    Processing & delivery
                  </Text>
                  <Text
                    style={[
                      styles.nextStepText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Your order will be prepared and you can track it in real
                    time.
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable
                style={[
                  styles.reviewButton,
                  { backgroundColor: BRAND.primary },
                ]}
                onPress={handleLeaveGoogleReview}
              >
                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 12,
                    padding: 2,
                  }}
                >
                  <GoogleLogo size={18} />
                </View>
                <Text style={styles.reviewButtonText}>
                  Leave a Google Review
                </Text>
              </Pressable>

              <View style={styles.actionRow}>
                <Pressable
                  style={[
                    styles.secondaryButton,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    },
                  ]}
                  onPress={handleContinueShopping}
                >
                  <Text
                    style={[styles.secondaryButtonText, { color: colors.text }]}
                  >
                    Continue Shopping
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.secondaryButton,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    },
                  ]}
                  onPress={handleViewOrders}
                >
                  <Text
                    style={[styles.secondaryButtonText, { color: colors.text }]}
                  >
                    View Orders
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 12,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyebrowPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 10,
  },
  eyebrowText: {
    color: BRAND.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    maxWidth: 320,
  },
  orderInfo: {
    width: '100%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
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
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  nextSteps: {
    width: '100%',
    marginBottom: 16,
  },
  nextTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  nextStepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  stepIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: BRAND.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStepBody: {
    flex: 1,
    gap: 4,
  },
  nextStepTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  nextStepText: {
    fontSize: 13,
    lineHeight: 19,
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
    gap: 10,
    width: '100%',
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 10,
  },
  reviewButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
