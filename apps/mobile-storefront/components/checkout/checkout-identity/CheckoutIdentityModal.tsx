import Ionicons from '@react-native-vector-icons/ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
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
import { useColorScheme } from '@/components/useColorScheme';
import { getCheckoutIdentityTheme } from './colors';
import {
  Divider,
  ErrorAlert,
  GuestCheckoutCard,
  SecurityFooter,
  SignInForm,
  SocialCheckoutButtons,
} from './components';
import {
  useBottomSheetAnimation,
  useHapticFeedback,
  useSignInForm,
} from './hooks';
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
  const colorScheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const theme = getCheckoutIdentityTheme(colorScheme);
  const { triggerHaptic } = useHapticFeedback();
  const [showEmailSignIn, setShowEmailSignIn] = useState(false);

  // Bottom sheet animations with reduced motion support
  const { animatedBackdropStyle, animatedSheetStyle } = useBottomSheetAnimation(
    {
      isOpen,
    }
  );

  const handleSignInSuccess = () => {
    setShowEmailSignIn(false);
    onClose();
  };

  const {
    error: socialAuthError,
    handleAppleSignIn,
    handleGoogleSignIn,
    isLoading: isSocialAuthLoading,
  } = useSignInForm({ onSuccess: handleSignInSuccess });

  const handleClose = () => {
    triggerHaptic('light');
    Keyboard.dismiss();
    setShowEmailSignIn(false);
    onClose();
  };

  const handleGuestCheckout = () => {
    triggerHaptic('light');
    setShowEmailSignIn(false);
    onClose();
    router.push('/checkout');
  };

  const handleShowEmailSignIn = () => {
    triggerHaptic('light');
    setShowEmailSignIn(true);
  };

  const handleShowCheckoutOptions = () => {
    triggerHaptic('light');
    Keyboard.dismiss();
    setShowEmailSignIn(false);
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
      <AppKeyboardContainer style={styles.container}>
        {/* Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            { backgroundColor: theme.backdrop },
            animatedBackdropStyle,
          ]}
        >
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
            {
              backgroundColor: theme.sheet,
              paddingBottom: 0,
            },
          ]}
          accessibilityRole="none"
        >
          {/* Handle - decorative */}
          <View
            style={styles.handleContainer}
            accessible={false}
            importantForAccessibility="no"
          >
            <View style={[styles.handle, { backgroundColor: theme.handle }]} />
          </View>
          <Pressable
            onPress={handleClose}
            style={[
              styles.floatingCloseButton,
              { backgroundColor: theme.closeButton },
            ]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            accessibilityHint="Close checkout modal"
          >
            <Ionicons
              name="close"
              size={22}
              color={theme.mutedText}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
          </Pressable>

          {/* Content */}
          <ScrollView
            style={{ maxHeight: 600 }}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            accessibilityRole="none"
          >
            {showEmailSignIn ? (
              <>
                <Pressable
                  onPress={handleShowCheckoutOptions}
                  style={styles.emailBackButton}
                  accessibilityRole="button"
                  accessibilityLabel="Back to checkout options"
                  accessibilityHint="Return to guest, Apple, and Google checkout options"
                >
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={theme.primary}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                  <Text
                    style={[
                      styles.emailBackButtonText,
                      { color: theme.primary },
                    ]}
                  >
                    Checkout options
                  </Text>
                </Pressable>
                <SignInForm
                  onSuccess={handleSignInSuccess}
                  showSocialButtons={false}
                  theme={theme}
                />
              </>
            ) : (
              <>
                <ErrorAlert error={socialAuthError} theme={theme} />
                <GuestCheckoutCard
                  onPress={handleGuestCheckout}
                  theme={theme}
                />
                <Divider text="or sign in instantly" theme={theme} />
                <SocialCheckoutButtons
                  isLoading={isSocialAuthLoading}
                  onAppleSignIn={handleAppleSignIn}
                  onGoogleSignIn={handleGoogleSignIn}
                  theme={theme}
                />
                <Pressable
                  onPress={handleShowEmailSignIn}
                  style={[
                    styles.emailSignInButton,
                    { borderColor: theme.border },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in with email"
                  accessibilityHint="Show the email and password sign in form"
                >
                  <Ionicons
                    name="mail-outline"
                    size={16}
                    color={theme.mutedText}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                  <Text
                    style={[
                      styles.emailSignInButtonText,
                      { color: theme.mutedText },
                    ]}
                  >
                    Sign in with email
                  </Text>
                </Pressable>
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <SecurityFooter bottomInset={insets.bottom} theme={theme} />
        </Animated.View>
      </AppKeyboardContainer>
    </Modal>
  );
}
