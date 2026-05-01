import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RADIUS, SPACING } from '@/constants/theme';
import { GoogleLogo } from './GoogleLogo';
import { styles as loginStyles } from './login.styles';

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
      <View style={loginStyles.divider}>
        <View
          style={[loginStyles.dividerLine, { backgroundColor: colors.border }]}
        />
        <Text style={[loginStyles.dividerText, { color: colors.textMuted }]}>
          or continue with
        </Text>
        <View
          style={[loginStyles.dividerLine, { backgroundColor: colors.border }]}
        />
      </View>

      <View style={loginStyles.socialButtons}>
        <Pressable
          style={({ pressed }) => [
            loginStyles.socialButton,
            { backgroundColor: colors.card, borderColor: colors.border },
            pressed && { opacity: 0.7 },
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
              <Text
                style={[loginStyles.socialButtonText, { color: colors.text }]}
              >
                Google
              </Text>
            </>
          )}
        </Pressable>

        {showAppleSignIn ? (
          <Pressable
            style={({ pressed }) => [
              loginStyles.socialButton,
              { backgroundColor: '#000', borderColor: '#000' },
              pressed && { opacity: 0.7 },
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
                <Text style={[loginStyles.socialButtonText, { color: '#FFF' }]}>
                  Apple
                </Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>

      <View style={loginStyles.signUpContainer}>
        <Text style={[loginStyles.signUpText, { color: colors.textMuted }]}>
          Don&apos;t have an account?
        </Text>
        <Pressable
          style={({ pressed }) => pressed && { opacity: 0.7 }}
          onPress={onSignUp}
          disabled={isAnyLoading}
          accessibilityRole="link"
          accessibilityLabel="Sign up for a new merchant account"
          accessibilityState={{ disabled: isAnyLoading }}
        >
          <Text
            style={[
              loginStyles.signUpLink,
              isAnyLoading && loginStyles.signUpLinkDisabled,
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
            try {
              await onResetOnboarding();
              Alert.alert(
                'Onboarding Reset',
                'You will now be taken to the onboarding screen.',
                [{ text: 'OK', onPress: () => replace('/(auth)/onboarding') }]
              );
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Please try again.';
              Alert.alert(
                'Reset Failed',
                `Could not reset onboarding. ${message}`
              );
            }
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
