import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppFormScreen } from '@/components/ui/AppFormScreen';
import { useTheme } from '@/hooks/useTheme';
import { SecurityFactorSelector } from './security-factor-selector';
import { securityStyles as styles } from './security-styles';
import { useSecurityMfaLifecycle } from './use-security-mfa-lifecycle';

export default function SecurityScreen() {
  const { colors } = useTheme();
  const {
    code,
    factorId,
    hasVerifiedFactor,
    isAal2,
    isBusy,
    pendingFactorId,
    setCode,
    setFactorId,
    setup,
    startEnrollment,
    restartEnrollment,
    verifiedFactors,
    verifyCode,
  } = useSecurityMfaLifecycle();

  if (isBusy && !factorId) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Security' }} />
      <AppFormScreen
        contentContainerStyle={styles.content}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>
            Authenticator 2FA
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Protect contact details, social links, receipts, and other sensitive
            settings with a second factor.
          </Text>

          {!factorId ? (
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={startEnrollment}
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={styles.primaryButtonText}>Set up authenticator</Text>
            </Pressable>
          ) : null}

          {hasVerifiedFactor && !pendingFactorId && !setup ? (
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={startEnrollment}
              style={[styles.secondaryButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.link, { color: colors.primary }]}>
                Add backup authenticator
              </Text>
            </Pressable>
          ) : null}

          {hasVerifiedFactor && pendingFactorId && !setup ? (
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={restartEnrollment}
              style={[styles.secondaryButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.link, { color: colors.primary }]}>
                Restart backup authenticator setup
              </Text>
            </Pressable>
          ) : null}

          {factorId && !hasVerifiedFactor && !setup ? (
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={restartEnrollment}
              style={[styles.secondaryButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.link, { color: colors.primary }]}>
                Restart authenticator setup
              </Text>
            </Pressable>
          ) : null}

          {!setup ? (
            <SecurityFactorSelector
              factors={verifiedFactors}
              onSelect={setFactorId}
              selectedFactorId={factorId}
            />
          ) : null}

          {setup ? (
            <View style={styles.setupBlock}>
              <Text style={[styles.label, { color: colors.text }]}>
                Setup key
              </Text>
              <Text selectable style={[styles.secret, { color: colors.text }]}>
                {setup.secret}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => Clipboard.setStringAsync(setup.secret)}
              >
                <Text style={[styles.link, { color: colors.primary }]}>
                  Copy setup key
                </Text>
              </Pressable>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                Add this key to Google Authenticator, 1Password, Authy, or
                another TOTP app. Then enter its 6-digit code below.
              </Text>
            </View>
          ) : null}

          {factorId ? (
            <View style={styles.verifyBlock}>
              <Text
                style={[
                  styles.status,
                  { color: isAal2 ? colors.success : colors.text },
                ]}
              >
                {isAal2
                  ? '2FA enabled and verified'
                  : 'Enter a code to verify this session'}
              </Text>
              <TextInput
                accessibilityLabel="Authenticator code"
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
                placeholder="123456"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.input,
                  { borderColor: colors.border, color: colors.text },
                ]}
                value={code}
              />
              <Pressable
                accessibilityRole="button"
                disabled={isBusy}
                onPress={verifyCode}
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.primary },
                ]}
              >
                {isBusy ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Verify code</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>

        <Text style={[styles.note, { color: colors.textSecondary }]}>
          Supabase does not provide recovery codes. Add a backup authenticator
          factor later and keep it on a separate device.
        </Text>
      </AppFormScreen>
    </>
  );
}
