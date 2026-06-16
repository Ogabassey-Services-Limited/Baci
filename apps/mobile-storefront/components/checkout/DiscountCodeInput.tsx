import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BRAND, palette, SPACING } from '@/constants/Colors';
import { createLogger } from '@/lib/logger';
import { validateDiscountCode } from '@/services/discount';

const logger = createLogger('DiscountCodeInput');

export interface AppliedDiscount {
  code: string;
  discountAmount: number;
}

interface DiscountCodeInputProps {
  merchantId: string;
  cartTotal: number;
  productIds?: string[];
  categoryIds?: string[];
  appliedDiscount: AppliedDiscount | null;
  onApply: (discount: AppliedDiscount) => void;
  onRemove: () => void;
}

export function DiscountCodeInput({
  merchantId,
  cartTotal,
  productIds,
  categoryIds,
  appliedDiscount,
  onApply,
  onRemove,
}: DiscountCodeInputProps) {
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleApply = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Please enter a discount code');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await validateDiscountCode({
        merchantId,
        code: trimmed,
        cartTotal,
        productIds,
        categoryIds,
      });
      if (!result.valid) {
        setError(result.error || 'Invalid discount code');
        return;
      }
      onApply({ code: result.code, discountAmount: result.discount_amount });
      setCode('');
    } catch (err) {
      logger.error('Discount code validation failed', err);
      setError('Could not validate code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (appliedDiscount) {
    return (
      <View style={styles.container}>
        <View style={styles.appliedRow}>
          <Text style={styles.appliedText}>
            {appliedDiscount.code} applied (−₦
            {appliedDiscount.discountAmount.toLocaleString()})
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove discount code"
            onPress={onRemove}
            hitSlop={8}
          >
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel="Discount code"
          placeholder="Discount code"
          autoCapitalize="characters"
          value={code}
          editable={!loading}
          onChangeText={(value) => {
            setCode(value.toUpperCase());
            setError(null);
          }}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Validates and applies the discount code to your order"
          disabled={loading || code.trim().length === 0}
          onPress={handleApply}
          style={[
            styles.applyButton,
            (loading || code.trim().length === 0) && styles.applyButtonDisabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.applyText}>Apply</Text>
          )}
        </Pressable>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.gray[300],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  applyButton: {
    backgroundColor: BRAND.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonDisabled: { opacity: 0.5 },
  applyText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  appliedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: palette.emerald[50],
    borderWidth: 1,
    borderColor: palette.emerald[200],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  appliedText: { color: palette.emerald[700], fontWeight: '600', fontSize: 14 },
  removeText: { color: palette.red[600], fontWeight: '600', fontSize: 13 },
  errorText: { color: palette.red[600], fontSize: 12, marginTop: 4 },
});
