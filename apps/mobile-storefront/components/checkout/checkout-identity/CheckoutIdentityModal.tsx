import Ionicons from "@react-native-vector-icons/ionicons/static";
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppKeyboardContainer from '@/components/ui/AppKeyboardContainer';
import { palette } from '@/constants/Colors';

import {
  CreateAccountCard,
  Divider,
  GuestCheckoutCard,
  SecurityFooter,
  SignInForm,
  TabSelector,
  type TabType,
} from './components';
import { useBottomSheetAnimation, useHapticFeedback } from './hooks';
import { styles } from './styles';

interface CheckoutIdentityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CheckoutIdentityModal({
  isOpen,
  onClose,
}: CheckoutIdentityModalProps) {
  const insets = useSafeAreaInsets();
  const { triggerHaptic } = useHapticFeedback();
  const [activeTab, setActiveTab] = useState<TabType>('new');

  // Bottom sheet animations with reduced motion support
  const { animatedBackdropStyle, animatedSheetStyle } = useBottomSheetAnimation(
    {
      isOpen,
    }
  );

  const handleClose = () => {
    triggerHaptic('light');
    Keyboard.dismiss();
    onClose();
  };

  const handleGuestCheckout = () => {
    triggerHaptic('light');
    onClose();
    router.push('/checkout');
  };

  const handleRegister = () => {
    triggerHaptic('light');
    onClose();
    router.push('/auth/login?mode=register&redirect=checkout');
  };

  const handleSignInSuccess = () => {
    onClose();
  };

  // Early return for closed state
  if (!isOpen) return null;

  return (
    <Modal
      key={`checkout-modal-${isOpen}`}
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
      accessible={true}
      accessibilityViewIsModal={true}
      accessibilityLabel="Checkout options modal"
    >
      <AppKeyboardContainer
        style={styles.container}
      >
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, animatedBackdropStyle]}>
          <Pressable
            style={styles.backdropPressable}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close modal"
            accessibilityHint="Double tap to close the checkout options"
          />
        </Animated.View>

        {/* Bottom Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            animatedSheetStyle,
            { paddingBottom: insets.bottom + 16 },
          ]}
          accessibilityRole="none"
        >
          {/* Handle - decorative */}
          <View
            style={styles.handleContainer}
            accessible={false}
            importantForAccessibility="no"
          >
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text
              style={styles.headerTitle}
              accessibilityRole="header"
            >
              Checkout
            </Text>
            <Pressable
              onPress={handleClose}
              style={styles.closeButton}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              accessibilityHint="Close checkout modal"
            >
              <Ionicons
                name="close"
                size={22}
                color={palette.gray[500]}
                accessibilityElementsHidden={true}
                importantForAccessibility="no"
              />
            </Pressable>
          </View>

          {/* Tabs */}
          <TabSelector activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Content */}
          <ScrollView
            style={{ maxHeight: 600 }}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            accessibilityRole="none"
          >
            {activeTab === 'new' ? (
              <>
                <GuestCheckoutCard onPress={handleGuestCheckout} />
                <Divider />
                <CreateAccountCard onPress={handleRegister} />
              </>
            ) : (
              <SignInForm onSuccess={handleSignInSuccess} />
            )}
          </ScrollView>

          {/* Footer */}
          <SecurityFooter />
        </Animated.View>
      </AppKeyboardContainer>
    </Modal>
  );
}
