import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { DateTimePickerField } from '@/components/ui/DateTimePickerField';
import { useTheme } from '@/hooks/useTheme';
import { getDateOfBirthValidationError } from '@/schemas/date-of-birth';
import { useAuthStore } from '@/stores/auth-store';
import { styles } from './DateOfBirthPrompt.styles';

interface DateOfBirthPromptProps {
  initialValue?: string;
  onSuccess?: (dateOfBirth: string) => void;
  submitLabel?: string;
}

/**
 * Collects a shopper's date of birth (native date picker, ISO `YYYY-MM-DD`) and
 * writes it via the authoritative `set_customer_date_of_birth` RPC. Mirrors
 * UsernamePrompt: client-side validation is UX-only; the RPC re-validates and
 * the server age gate owns the 18+ decision.
 */
export function DateOfBirthPrompt({
  initialValue = '',
  onSuccess,
  submitLabel = 'Save date of birth',
}: DateOfBirthPromptProps) {
  const { colors } = useTheme();
  const setDateOfBirth = useAuthStore((state) => state.setDateOfBirth);

  const [value, setValue] = useState(initialValue);
  const [lastInitialValue, setLastInitialValue] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Sync local input state when the parent supplies a new `initialValue` after
  // mount (e.g. a returning shopper whose customer row hydrates after this
  // prompt first rendered). React's "adjust state during render" pattern avoids
  // an extra render pass and stays React Compiler friendly.
  if (initialValue !== lastInitialValue) {
    setLastInitialValue(initialValue);
    setValue(initialValue);
    setSubmitError(null);
  }

  const validationError =
    value.length > 0 ? getDateOfBirthValidationError(value) : null;
  const isSubmitDisabled =
    isSubmitting || value.length === 0 || validationError !== null;
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
    return setDateOfBirth(value)
      .then((result) => {
        if (result.success) {
          onSuccess?.(result.dateOfBirth ?? value);
        } else {
          setSubmitError(result.error || 'Could not save date of birth');
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
      <DateTimePickerField
        accessibilityLabel="Date of birth"
        fallbackDisplay="Select your date of birth"
        fieldStyle={[
          styles.field,
          { backgroundColor: colors.muted },
          { borderColor: errorMessage ? colors.error : colors.border },
        ]}
        label="Date of birth"
        labelStyle={[styles.label, { color: colors.textSecondary }]}
        mode="date"
        onChangeText={handleChangeText}
        textStyle={[
          styles.fieldText,
          { color: value ? colors.text : colors.placeholder },
        ]}
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
          You must be 18 or older to play. We only use this to confirm your age.
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
          {
            backgroundColor: isSubmitDisabled ? colors.border : colors.primary,
          },
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
