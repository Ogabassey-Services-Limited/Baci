import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppFormScreen } from '@/components/ui/AppFormScreen';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { securityStyles as styles } from './security-styles';

interface TotpSetup {
  factorId: string;
  secret: string;
}

export default function SecurityScreen() {
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [hasVerifiedFactor, setHasVerifiedFactor] = useState(false);
  const [isAal2, setIsAal2] = useState(false);
  const [isBusy, setIsBusy] = useState(true);
  const [setup, setSetup] = useState<TotpSetup | null>(null);

  const loadSecurityState = async () => {
    setIsBusy(true);
    const [{ data: factors, error: factorsError }, { data: assurance }] =
      await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);

    if (factorsError) {
      Alert.alert('Security Error', factorsError.message);
      setIsBusy(false);
      return;
    }

    const verifiedFactor = factors.totp.find(
      (factor) => factor.status === 'verified'
    );
    const pendingFactor = factors.all.find(
      (factor) =>
        factor.factor_type === 'totp' && factor.status === 'unverified'
    );
    setFactorId(verifiedFactor?.id ?? pendingFactor?.id ?? null);
    setHasVerifiedFactor(Boolean(verifiedFactor));
    setIsAal2(assurance?.currentLevel === 'aal2');
    setIsBusy(false);
  };

  useEffect(() => {
    let isActive = true;

    void Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]).then(([{ data: factors, error }, { data: assurance }]) => {
      if (!isActive) return;
      if (error) {
        Alert.alert('Security Error', error.message);
        setIsBusy(false);
        return;
      }

      const verifiedFactor = factors.totp.find(
        (factor) => factor.status === 'verified'
      );
      const pendingFactor = factors.all.find(
        (factor) =>
          factor.factor_type === 'totp' && factor.status === 'unverified'
      );
      setFactorId(verifiedFactor?.id ?? pendingFactor?.id ?? null);
      setHasVerifiedFactor(Boolean(verifiedFactor));
      setIsAal2(assurance?.currentLevel === 'aal2');
      setIsBusy(false);
    });

    return () => {
      isActive = false;
    };
  }, []);

  const startEnrollment = async () => {
    setIsBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Baci Admin authenticator',
    });
    setIsBusy(false);

    if (error) {
      Alert.alert('Could not enable 2FA', error.message);
      return;
    }

    setSetup({ factorId: data.id, secret: data.totp.secret });
    setFactorId(data.id);
  };

  const verifyCode = async () => {
    if (!factorId || !/^\d{6}$/.test(code)) {
      Alert.alert('Enter the code', 'Enter the 6-digit authenticator code.');
      return;
    }

    setIsBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      code,
      factorId,
    });
    setIsBusy(false);

    if (error) {
      Alert.alert('Verification failed', error.message);
      return;
    }

    setCode('');
    setSetup(null);
    await loadSecurityState();
    Alert.alert(
      'Two-factor authentication enabled',
      'Your session is verified.'
    );
  };

  const restartEnrollment = async () => {
    if (!factorId) return;

    setIsBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setIsBusy(false);
    if (error) {
      Alert.alert('Could not restart 2FA setup', error.message);
      return;
    }

    setFactorId(null);
    await startEnrollment();
  };

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
              onPress={startEnrollment}
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={styles.primaryButtonText}>Set up authenticator</Text>
            </Pressable>
          ) : null}

          {hasVerifiedFactor && !setup ? (
            <Pressable
              accessibilityRole="button"
              onPress={startEnrollment}
              style={[styles.secondaryButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.link, { color: colors.primary }]}>
                Add backup authenticator
              </Text>
            </Pressable>
          ) : null}

          {factorId && !hasVerifiedFactor && !setup ? (
            <Pressable
              accessibilityRole="button"
              onPress={restartEnrollment}
              style={[styles.secondaryButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.link, { color: colors.primary }]}>
                Restart authenticator setup
              </Text>
            </Pressable>
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
