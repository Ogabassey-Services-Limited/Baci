import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import type Colors from '@/constants/Colors';
import { WalletFundPhoneSchema } from '@/schemas/wallet-fund-phone';
import { styles as walletStyles } from './wallet.styles';

type WalletColors = (typeof Colors)['light'];

export interface WalletFundPhoneSubmitResult {
  error?: string;
  success: boolean;
}

interface WalletFundPhonePromptProps {
  colors: WalletColors;
  onSubmit: (phone: string) => Promise<WalletFundPhoneSubmitResult>;
}

const PROMPT_COPY =
  'Add your phone number so we can create your bank transfer account number.';
const SAVE_FAILED = 'Could not save your phone number. Please try again.';

export function WalletFundPhonePrompt({
  colors,
  onSubmit,
}: WalletFundPhonePromptProps) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    const parsed = WalletFundPhoneSchema.safeParse({ phone });
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? 'Valid phone number required'
      );
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const result = await onSubmit(parsed.data.phone);
      // Leave the error visible so the customer can correct and retry; a
      // successful save flips availability and unmounts this prompt.
      if (!result.success) {
        setError(result.error ?? SAVE_FAILED);
      }
    } catch {
      setError(SAVE_FAILED);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Text
        style={[
          walletStyles.redeemPanelSubtitle,
          { color: colors.textSecondary },
        ]}
      >
        {PROMPT_COPY}
      </Text>
      <TextInput
        accessibilityLabel="Phone number"
        style={[
          walletStyles.redeemInput,
          {
            backgroundColor: colors.muted,
            borderColor: colors.primary,
            borderWidth: 2,
            color: colors.text,
          },
        ]}
        value={phone}
        onChangeText={(value) => {
          setPhone(value);
          if (error) {
            setError(null);
          }
        }}
        editable={!isSaving}
        keyboardType="phone-pad"
        autoCapitalize="none"
        placeholder="08012345678"
        placeholderTextColor={colors.placeholder}
      />
      {error ? (
        <Text
          accessibilityRole="text"
          style={[styles.error, { color: colors.error }]}
        >
          {error}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save phone number"
        accessibilityState={{ disabled: isSaving }}
        style={[styles.submit, { backgroundColor: colors.primary }]}
        onPress={handleSubmit}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color={colors.background} size="small" />
        ) : (
          <Text style={[styles.submitText, { color: colors.background }]}>
            Save and continue
          </Text>
        )}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  error: {
    fontSize: 12,
    marginBottom: 12,
    marginTop: -4,
  },
  submit: {
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 14,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
