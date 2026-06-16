import Ionicons from '@react-native-vector-icons/ionicons';
import React from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { GoogleLogo } from '../../../icons/GoogleLogo';
import type { CheckoutIdentityTheme } from '../colors';
import { styles } from '../styles';
import type { SocialSignInButtonsProps } from '../types';

interface ThemedSocialSignInButtonsProps extends SocialSignInButtonsProps {
  theme: CheckoutIdentityTheme;
}

/**
 * Social Divider - "OR" separator between form and social buttons
 */
function SocialDivider({ theme }: { theme: CheckoutIdentityTheme }) {
  return (
    <View
      style={[styles.divider, { marginTop: 4, marginBottom: 8 }]}
      accessibilityRole="none"
    >
      <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
      <Text style={[styles.dividerText, { color: theme.footerText }]}>OR</Text>
      <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
    </View>
  );
}

/**
 * Social sign-in buttons with Google and Apple (iOS only)
 */
export function SocialSignInButtons({
  isLoading,
  onGoogleSignIn,
  onAppleSignIn,
  theme,
}: ThemedSocialSignInButtonsProps) {
  return (
    <>
      <SocialDivider theme={theme} />
      <View style={{ gap: 8 }}>
        {/* Google Sign-In */}
        <TouchableOpacity
          style={[
            styles.socialButton,
            { backgroundColor: theme.input, borderColor: theme.border },
            isLoading && styles.socialButtonDisabled,
          ]}
          onPress={onGoogleSignIn}
          disabled={isLoading}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          accessibilityHint="Sign in using your Google account"
          accessibilityState={{ disabled: isLoading }}
        >
          <GoogleLogo size={20} />
          <Text style={[styles.socialButtonText, { color: theme.text }]}>
            Continue with Google
          </Text>
        </TouchableOpacity>

        {/* Apple Sign-In (iOS only) */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[
              styles.socialButton,
              { backgroundColor: theme.input, borderColor: theme.border },
              isLoading && styles.socialButtonDisabled,
            ]}
            onPress={onAppleSignIn}
            disabled={isLoading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Continue with Apple"
            accessibilityHint="Sign in using your Apple ID"
            accessibilityState={{ disabled: isLoading }}
          >
            <Ionicons
              name="logo-apple"
              size={18}
              color={theme.text}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text style={[styles.socialButtonText, { color: theme.text }]}>
              Continue with Apple
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}
