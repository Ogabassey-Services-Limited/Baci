/**
 * Order Success Screen
 * Shown after successful order placement
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { OrderSuccessView } from '@/components/orders/OrderSuccessView';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { usePermissionBooster } from '@/hooks/use-permission-booster';
import { BACI_GOOGLE_REVIEW_URL } from '@/lib/post-purchase-actions';
import { useAuthStore } from '@/stores/auth-store';

export default function OrderSuccessScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const {
    orderNumber,
    reference,
    trackingToken,
    paymentMethod,
    deliveryEstimate,
  } = useLocalSearchParams<Record<string, string>>();
  const customer = useAuthStore((s) => s.customer);

  const { requestPermission, triggerSystemPrompt, markDenied } =
    usePermissionBooster();
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  useEffect(() => {
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
  }, [requestPermission]);

  const handlePermissionGrant = async () => {
    setShowPermissionModal(false);
    await triggerSystemPrompt('notifications');
  };

  const handlePermissionDeny = () => {
    setShowPermissionModal(false);
    markDenied('notifications');
  };

  const handleContinueShopping = () => {
    router.replace('/');
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
    <OrderSuccessView
      colors={colors}
      deliveryEstimate={deliveryEstimate}
      isDark={colorScheme === 'dark'}
      onContinueShopping={handleContinueShopping}
      onLeaveGoogleReview={handleLeaveGoogleReview}
      onPermissionDeny={handlePermissionDeny}
      onPermissionGrant={handlePermissionGrant}
      onViewOrders={handleViewOrders}
      orderNumber={orderNumber}
      paymentMethod={paymentMethod}
      reference={reference}
      showPermissionModal={showPermissionModal}
    />
  );
}
