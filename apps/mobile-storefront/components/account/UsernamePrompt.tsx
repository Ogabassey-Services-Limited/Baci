import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { cleanUsername, getUsernameValidationError } from '@/schemas/username';
import { useAuthStore } from '@/stores/auth-store';
import { styles } from './UsernamePrompt.styles';

interface UsernamePromptProps {
  initialValue?: string;
  onSuccess?: (username: string) => void;
  submitLabel?: string;
}

export function UsernamePrompt({
  initialValue = '',
  onSuccess,
  submitLabel = 'Save username',
}: UsernamePromptProps) {
  const { colors } = useTheme();
  const setUsername = useAuthStore((state) => state.setUsername);

  const [value, setValue] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Clean (NFKC + zero-width strip + trim) before validating and submitting so
  // the mobile client feeds the RPC the same normalized value the web route
  // does — otherwise a full-width look-alike would validate here yet be
  // rejected server-side.
  const cleanedValue = cleanUsername(value);
  const validationError =
    cleanedValue.length > 0 ? getUsernameValidationError(cleanedValue) : null;
  const isSubmitDisabled =
    isSubmitting || cleanedValue.length === 0 || validationError !== null;
  const errorMessage = submitError ?? validationError;

  const handleChangeText = (text: string) => {
    setValue(text);
    if (submitError) setSubmitError(null);
  };

  // Promise chain instead of try/finally: a `finally` clause in the component
  // body makes React Compiler bail out of memoizing this component.
  const handleSubmit = () => {
    if (isSubmitDisabled) return undefined;

    setIsSubmitting(true);
    setSubmitError(null);
    return setUsername(cleanedValue)
      .then((result) => {
        if (result.success) {
          onSuccess?.(result.username ?? cleanedValue);
        } else {
          setSubmitError(result.error || 'Could not set username');
        }
      })
      .catch(() => {
        setSubmitError('Something went wrong. Please try again.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Username
      </Text>
      <TextInput
        accessibilityHint="3 to 20 letters, numbers, periods, or underscores"
        accessibilityLabel="Username"
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect={false}
        maxLength={20}
        onChangeText={handleChangeText}
        placeholder="yourname"
        placeholderTextColor={colors.placeholder}
        style={[
          styles.input,
          { backgroundColor: colors.muted, color: colors.text },
          { borderColor: errorMessage ? colors.error : colors.border },
        ]}
        textContentType="none"
        value={value}
      />
      {errorMessage ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={[styles.errorText, { color: colors.error }]}
        >
          {errorMessage}
        </Text>
      ) : (
        <Text style={[styles.helperText, { color: colors.textSecondary }]}>
          3-20 characters. Letters, numbers, . and _ only.
        </Text>
      )}
      <Pressable
        accessibilityLabel={submitLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: isSubmitDisabled }}
        disabled={isSubmitDisabled}
        onPress={() => {
          void handleSubmit();
        }}
        style={[
          styles.submitButton,
          { backgroundColor: isSubmitDisabled ? colors.border : colors.primary },
        ]}
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text
            style={[
              styles.submitButtonText,
              { color: colors.primaryForeground },
            ]}
          >
            {submitLabel}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
