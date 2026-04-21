import type { PaymentStatus } from '@baci/shared';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';
import { TYPOGRAPHY } from '@/constants/theme';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { PAYMENT_METHODS } from './new-order.shared';
import { styles } from './new-order.styles';

interface NewOrderFooterBarProps {
  controller: ReturnType<typeof useNewOrderController>;
}

export function NewOrderFooterBar({ controller }: NewOrderFooterBarProps) {
  const {
    colors,
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
        { backgroundColor: colors.card, borderTopColor: colors.border },
      ]}
    >
      <View
        style={[
          styles.paymentToggle,
          { backgroundColor: colors.inputBg },
        ]}
      >
        {(['unpaid', 'paid', 'partially_paid'] as PaymentStatus[]).map(
          (status) => {
            const isSelected = paymentStatus === status;
            return (
              <Pressable
                key={status}
                onPress={() => {
                  setPaymentStatus(status);
                  if (status !== 'partially_paid') {
                    setPartialAmount('');
                  }
                }}
                style={[
                  styles.toggleOption,
                  isSelected && {
                    backgroundColor: colors.background,
                    elevation: 2,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.toggleText,
                    {
                      color: isSelected
                        ? status === 'paid'
                          ? colors.success
                          : status === 'unpaid'
                            ? colors.error
                            : colors.warning
                        : colors.textSecondary,
                    },
                  ]}
                >
                  {status === 'partially_paid' ? 'Partial' : status.toUpperCase()}
                </Text>
              </Pressable>
            );
          }
        )}
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
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {PAYMENT_METHODS.map((method) => (
              <Pressable
                key={method.id}
                onPress={() => setPaymentMethod(method.id)}
                style={{
                  alignItems: 'center',
                  backgroundColor:
                    paymentMethod === method.id ? colors.primary : colors.card,
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
                }}
              >
                <Ionicons
                  color={paymentMethod === method.id ? colors.textOnPrimary : colors.text}
                  name={method.icon as keyof typeof Ionicons.glyphMap}
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
          disabled={isSubmitting || orderItems.length === 0}
          onPress={handleSubmit}
          style={[
            styles.payBtn,
            {
              backgroundColor: colors.primary,
              opacity: orderItems.length === 0 ? 0.6 : 1,
            },
          ]}
        >
          <Text style={[styles.payBtnText, { color: colors.textOnPrimary }]}>
            Save Order
          </Text>
          <Ionicons
            color={colors.textOnPrimary}
            name="arrow-forward"
            size={20}
          />
        </Pressable>
      </View>
    </View>
  );
}
