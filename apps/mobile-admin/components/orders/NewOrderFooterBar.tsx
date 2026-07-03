import type { PaymentStatus } from '@baci/shared';
import Ionicons, {
  type IoniconsIconName,
} from '@react-native-vector-icons/ionicons';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TYPOGRAPHY } from '@/constants/theme';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { PAYMENT_METHODS } from './new-order.shared';
import {
  NEW_ORDER_FOOTER_BASE_PADDING_BOTTOM,
  styles,
} from './new-order.styles';

interface NewOrderFooterBarProps {
  controller: ReturnType<typeof useNewOrderController>;
}

const PAYMENT_STATUS_OPTIONS: {
  icon: IoniconsIconName;
  label: string;
  value: PaymentStatus;
}[] = [
  { icon: 'alert-circle', label: 'UNPAID', value: 'unpaid' },
  { icon: 'checkmark-circle', label: 'PAID', value: 'paid' },
  { icon: 'remove-circle', label: 'Partial', value: 'partially_paid' },
];

export function NewOrderFooterBar({ controller }: NewOrderFooterBarProps) {
  const insets = useSafeAreaInsets();
  const {
    colors,
    shadows,
    formatPrice,
    handleSubmit,
    isSubmitting,
    orderItems,
    partialAmount,
    paymentMethod,
    paymentStatus,
    setPartialAmount,
    setPaymentMethod,
    setPaymentStatus,
    total,
  } = controller;

  return (
    <View
      style={[
        styles.footer,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: NEW_ORDER_FOOTER_BASE_PADDING_BOTTOM + insets.bottom,
        },
      ]}
      testID="new-order-footer-bar"
    >
      <View style={styles.paymentStatusField}>
        <Text
          style={[styles.footerFieldLabel, { color: colors.textSecondary }]}
        >
          Payment Status
        </Text>
        <View
          accessibilityLabel="Payment status"
          accessibilityRole="radiogroup"
          style={[styles.paymentToggle, { backgroundColor: colors.inputBg }]}
        >
          {PAYMENT_STATUS_OPTIONS.map(({ icon, label, value }) => {
            const statusColor =
              value === 'paid'
                ? colors.success
                : value === 'unpaid'
                  ? colors.error
                  : colors.warning;
            const isSelected = paymentStatus === value;
            return (
              <Pressable
                accessibilityLabel={`Payment status: ${label}`}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: isSelected,
                  disabled: isSubmitting,
                }}
                disabled={isSubmitting}
                key={value}
                onPress={() => {
                  setPaymentStatus(value);
                  if (value !== 'partially_paid') {
                    setPartialAmount('');
                  }
                }}
                style={({ pressed }) => [
                  !isSubmitting && pressed && { opacity: 0.7 },
                  styles.toggleOption,
                  {
                    backgroundColor: isSelected
                      ? colors.background
                      : colors.card,
                    borderColor: isSelected ? statusColor : colors.border,
                    borderWidth: 1,
                  },
                  isSelected && shadows.sm,
                ]}
              >
                <Ionicons
                  color={isSelected ? statusColor : colors.textSecondary}
                  name={icon}
                  size={14}
                />
                <Text
                  style={[
                    styles.toggleText,
                    {
                      color: isSelected ? statusColor : colors.textSecondary,
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {['paid', 'partially_paid'].includes(paymentStatus) && (
        <View style={{ marginBottom: 4 }}>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: '600',
              marginBottom: 8,
              marginLeft: 4,
            }}
          >
            Payment Method
          </Text>
          <View
            accessibilityLabel="Payment method"
            accessibilityRole="radiogroup"
            style={{ flexDirection: 'row', gap: 8 }}
          >
            {PAYMENT_METHODS.map((method) => (
              <Pressable
                accessibilityLabel={`Payment method: ${method.label}`}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: paymentMethod === method.id,
                  disabled: isSubmitting,
                }}
                disabled={isSubmitting}
                key={method.id}
                onPress={() => setPaymentMethod(method.id)}
                style={({ pressed }) => [
                  {
                    opacity: !isSubmitting && pressed ? 0.7 : 1,
                    alignItems: 'center',
                    backgroundColor:
                      paymentMethod === method.id
                        ? colors.primary
                        : colors.card,
                    borderColor:
                      paymentMethod === method.id
                        ? colors.primary
                        : colors.border,
                    borderRadius: 12,
                    borderWidth: 1,
                    flex: 1,
                    flexDirection: 'row',
                    gap: 6,
                    justifyContent: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  },
                ]}
              >
                <Ionicons
                  color={
                    paymentMethod === method.id
                      ? colors.textOnPrimary
                      : colors.text
                  }
                  name={method.icon as IoniconsIconName}
                  size={18}
                />
                <Text
                  style={{
                    color:
                      paymentMethod === method.id
                        ? colors.textOnPrimary
                        : colors.text,
                    fontSize: 13,
                    fontWeight: '600',
                  }}
                >
                  {method.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {paymentStatus === 'partially_paid' && (
        <View style={{ marginBottom: 4 }}>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: '600',
              marginBottom: 8,
              marginLeft: 4,
            }}
          >
            Amount Paid
          </Text>
          <TextInput
            accessibilityState={{ disabled: isSubmitting }}
            editable={!isSubmitting}
            keyboardType="numeric"
            onChangeText={setPartialAmount}
            placeholder="Enter amount..."
            placeholderTextColor={colors.textMuted}
            style={{
              backgroundColor: colors.inputBg,
              borderRadius: 12,
              color: colors.text,
              fontSize: 16,
              fontWeight: '500',
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
            value={partialAmount}
          />
        </View>
      )}

      <View style={styles.footerRow}>
        <View>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            Total Amount
          </Text>
          <Text
            style={{
              color: colors.text,
              fontFamily: TYPOGRAPHY.fontFamily.bold,
              fontSize: 24,
            }}
          >
            {formatPrice(total)}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={isSubmitting ? 'Saving order' : 'Save Order'}
          accessibilityRole="button"
          accessibilityState={{
            disabled: isSubmitting || orderItems.length === 0,
            busy: isSubmitting,
          }}
          disabled={isSubmitting || orderItems.length === 0}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.payBtn,
            {
              backgroundColor: colors.primary,
              opacity: isSubmitting || orderItems.length === 0 ? 0.6 : 1,
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator
              color={colors.textOnPrimary}
              style={{ marginRight: 8 }}
            />
          ) : null}
          <Text style={[styles.payBtnText, { color: colors.textOnPrimary }]}>
            {isSubmitting ? 'Saving...' : 'Save Order'}
          </Text>
          {!isSubmitting && (
            <Ionicons
              color={colors.textOnPrimary}
              name="arrow-forward"
              size={20}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}
