import Ionicons from "@react-native-vector-icons/ionicons/static";
import React from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { GoogleLogo } from '../../../icons/GoogleLogo';
import { palette } from '@/constants/Colors';
import type { SocialSignInButtonsProps } from '../types';
import { styles } from '../styles';

/**
 * Social Divider - "OR" separator between form and social buttons
 */
function SocialDivider() {
  return (
    <View style={[styles.divider, { marginTop: 4, marginBottom: 8 }]} accessibilityRole="none">
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>OR</Text>
      <View style={styles.dividerLine} />
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
}: SocialSignInButtonsProps) {
  return (
    <>
      <SocialDivider />
      <View style={{ gap: 8 }}>
        {/* Google Sign-In */}
        <TouchableOpacity
          style={[styles.socialButton, isLoading && styles.socialButtonDisabled]}
          onPress={onGoogleSignIn}
          disabled={isLoading}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          accessibilityHint="Sign in using your Google account"
          accessibilityState={{ disabled: isLoading }}
        >
          <GoogleLogo size={20} />
          <Text style={styles.socialButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Apple Sign-In (iOS only) */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[styles.socialButton, isLoading && styles.socialButtonDisabled]}
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
              color={palette.gray[900]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text style={styles.socialButtonText}>Continue with Apple</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}
