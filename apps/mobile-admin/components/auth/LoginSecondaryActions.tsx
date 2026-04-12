import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BRAND } from '@/constants/brand';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { GoogleLogo } from './GoogleLogo';

interface LoginSecondaryActionsProps {
  colors: {
    border: string;
    card: string;
    text: string;
    textMuted: string;
  };
  isAnyLoading: boolean;
  isAppleLoading: boolean;
  isGoogleLoading: boolean;
  onAppleSignIn: () => void;
  onGoogleSignIn: () => void;
  onResetOnboarding?: () => Promise<void>;
  onSignUp: () => void;
  replace: (href: '/(auth)/onboarding') => void;
  showAppleSignIn: boolean;
}

export function LoginSecondaryActions({
  colors,
  isAnyLoading,
  isAppleLoading,
  isGoogleLoading,
  onAppleSignIn,
  onGoogleSignIn,
  onResetOnboarding,
  onSignUp,
  replace,
  showAppleSignIn,
}: LoginSecondaryActionsProps) {
  return (
    <>
      <View style={styles.divider}>
        <View
          style={[styles.dividerLine, { backgroundColor: colors.border }]}
        />
        <Text style={[styles.dividerText, { color: colors.textMuted }]}>
          or continue with
        </Text>
        <View
          style={[styles.dividerLine, { backgroundColor: colors.border }]}
        />
      </View>

      <View style={styles.socialButtons}>
        <Pressable
          style={[
            styles.socialButton,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={onGoogleSignIn}
          disabled={isAnyLoading}
          accessibilityRole="button"
          accessibilityLabel={
            isGoogleLoading ? 'Signing in with Google' : 'Sign in with Google'
          }
          accessibilityState={{ disabled: isAnyLoading }}
        >
          {isGoogleLoading ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <>
              <GoogleLogo size={20} />
              <Text style={[styles.socialButtonText, { color: colors.text }]}>
                Google
              </Text>
            </>
          )}
        </Pressable>

        {showAppleSignIn ? (
          <Pressable
            style={[
              styles.socialButton,
              { backgroundColor: '#000', borderColor: '#000' },
            ]}
            onPress={onAppleSignIn}
            disabled={isAnyLoading}
            accessibilityRole="button"
            accessibilityLabel={
              isAppleLoading ? 'Signing in with Apple' : 'Sign in with Apple'
            }
            accessibilityState={{ disabled: isAnyLoading }}
          >
            {isAppleLoading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="logo-apple" size={20} color="#FFF" />
                <Text style={[styles.socialButtonText, { color: '#FFF' }]}>
                  Apple
                </Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>

      <View style={styles.signUpContainer}>
        <Text style={[styles.signUpText, { color: colors.textMuted }]}>
          Don&apos;t have an account?
        </Text>
        <Pressable
          onPress={onSignUp}
          disabled={isAnyLoading}
          accessibilityRole="link"
          accessibilityLabel="Sign up for a new merchant account"
          accessibilityState={{ disabled: isAnyLoading }}
        >
          <Text
            style={[
              styles.signUpLink,
              isAnyLoading && styles.signUpLinkDisabled,
            ]}
          >
            Sign Up
          </Text>
        </Pressable>
      </View>

      {__DEV__ && onResetOnboarding ? (
        <Pressable
          style={styles.devResetButton}
          onPress={async () => {
            await onResetOnboarding();
            Alert.alert(
              'Onboarding Reset',
              'You will now be taken to the onboarding screen.',
              [{ text: 'OK', onPress: () => replace('/(auth)/onboarding') }]
            );
          }}
        >
          <Ionicons name="refresh-outline" size={20} color="#D97706" />
          <Text style={styles.devResetText}>Reset Onboarding (Dev)</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    gap: SPACING.sm,
  },
  socialButtonText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING['3xl'],
    gap: SPACING.xs,
  },
  signUpText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  signUpLink: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    color: BRAND.yellow,
  },
  signUpLinkDisabled: {
    opacity: 0.5,
  },
  devResetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 8,
    marginTop: SPACING.xl,
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  devResetText: {
    color: '#D97706',
    fontWeight: '600',
  },
});
