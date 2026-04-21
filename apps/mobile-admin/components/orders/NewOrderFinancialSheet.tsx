import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import { AppSheetModal } from '@/components/ui/AppSheetModal';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { formatPriceInput, parseDecimalInput } from './new-order.shared';

interface NewOrderFinancialSheetProps {
  controller: ReturnType<typeof useNewOrderController>;
}

export function NewOrderFinancialSheet({
  controller,
}: NewOrderFinancialSheetProps) {
  const {
    calculatedVat,
    colors,
    financialValue,
    isVatApplied,
    merchant,
    setDiscount,
    setFinancialValue,
    setIsVatApplied,
    setShippingFee,
    setShowFinancialModal,
    setTaxes,
    shadows,
    showFinancialModal,
    vatRate,
  } = controller;
  const currencyCode = merchant?.payout_currency?.trim() || null;

  return (
    <AppSheetModal
      accessibilityLabel="Financial adjustments sheet"
      onClose={() =>
        setShowFinancialModal({ ...showFinancialModal, visible: false })
      }
      visible={showFinancialModal.visible}
    >
      <View
        style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: 24,
        }}
      >
        <View
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 24,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>
            {showFinancialModal.type === 'discount'
              ? 'Add Discount'
              : showFinancialModal.type === 'shipping'
                ? 'Shipping Fee'
                : 'Taxes'}
          </Text>
          <Pressable
            accessibilityLabel="Close financial modal"
            accessibilityRole="button"
            onPress={() =>
              setShowFinancialModal({ ...showFinancialModal, visible: false })
            }
          >
            <Ionicons color={colors.text} name="close" size={24} />
          </Pressable>
        </View>

        {showFinancialModal.type === 'tax' &&
        merchant?.vat_registration_status === 'registered' ? (
          <View
            style={{
              alignItems: 'center',
              backgroundColor: `${colors.primary}08`,
              borderColor: `${colors.primary}20`,
              borderRadius: 16,
              borderWidth: 1,
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 20,
              padding: 16,
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 16,
                  fontWeight: '700',
                  marginBottom: 2,
                }}
              >
                Apply {(vatRate * 100).toFixed(1)}% VAT
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                Automatic calculation based on subtotal
              </Text>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: isVatApplied }}
              onPress={() => setIsVatApplied(!isVatApplied)}
              style={{
                backgroundColor: isVatApplied ? colors.primary : colors.border,
                borderRadius: 16,
                height: 32,
                justifyContent: 'center',
                paddingHorizontal: 4,
                width: 52,
              }}
            >
              <View
                style={{
                  ...shadows.sm,
                  alignSelf: isVatApplied ? 'flex-end' : 'flex-start',
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  height: 24,
                  width: 24,
                }}
              />
            </Pressable>
          </View>
        ) : null}

        {showFinancialModal.type === 'tax' &&
        merchant?.vat_registration_status !== 'registered' ? (
          <Pressable
            onPress={() => {
              setShowFinancialModal({ ...showFinancialModal, visible: false });
              router.push('/tax');
            }}
            style={{
              alignItems: 'center',
              backgroundColor: `${colors.info}10`,
              borderColor: `${colors.info}20`,
              borderRadius: 16,
              borderWidth: 1,
              flexDirection: 'row',
              gap: 12,
              marginBottom: 20,
              padding: 16,
            }}
          >
            <Ionicons color={colors.info} name="information-circle" size={24} />
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: colors.info, fontSize: 15, fontWeight: '700' }}
              >
                Setup VAT Module
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                Enable automatic VAT at {(vatRate * 100).toFixed(1)}%
              </Text>
            </View>
            <Ionicons color={colors.info} name="arrow-forward" size={18} />
          </Pressable>
        ) : null}

        <Text
          style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 8 }}
        >
          {showFinancialModal.type === 'tax' && isVatApplied
            ? 'Calculated VAT Amount'
            : currencyCode
              ? `Amount (${currencyCode})`
              : 'Amount'}
        </Text>
        <TextInput
          editable={!(showFinancialModal.type === 'tax' && isVatApplied)}
          keyboardType="numeric"
          onChangeText={(text) => {
            setFinancialValue(parseDecimalInput(text));
          }}
          placeholder="0.00"
          placeholderTextColor={colors.textMuted}
          style={{
            backgroundColor:
              isVatApplied && showFinancialModal.type === 'tax'
                ? colors.backgroundLight
                : colors.inputBg,
            borderRadius: 16,
            color:
              isVatApplied && showFinancialModal.type === 'tax'
                ? colors.textMuted
                : colors.text,
            fontSize: 18,
            fontWeight: '600',
            marginBottom: 24,
            padding: 18,
          }}
          value={
            showFinancialModal.type === 'tax' && isVatApplied
              ? controller.formatPrice(calculatedVat)
              : formatPriceInput(financialValue)
          }
        />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (showFinancialModal.type === 'discount') setDiscount(0);
              if (showFinancialModal.type === 'shipping') setShippingFee(0);
              if (showFinancialModal.type === 'tax') {
                setTaxes(0);
                setIsVatApplied(false);
              }
              setShowFinancialModal({ ...showFinancialModal, visible: false });
            }}
            style={{
              alignItems: 'center',
              backgroundColor: colors.inputBg,
              borderRadius: 12,
              flex: 1,
              paddingVertical: 16,
            }}
          >
            <Text style={{ color: colors.error, fontWeight: '600' }}>
              Clear
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const value = Number.parseFloat(financialValue) || 0;
              if (showFinancialModal.type === 'discount') setDiscount(value);
              if (showFinancialModal.type === 'shipping') setShippingFee(value);
              if (showFinancialModal.type === 'tax') {
                setTaxes(isVatApplied ? calculatedVat : value);
              }
              setShowFinancialModal({ ...showFinancialModal, visible: false });
            }}
            style={{
              alignItems: 'center',
              backgroundColor: colors.primary,
              borderRadius: 12,
              flex: 2,
              paddingVertical: 16,
            }}
          >
            <Text style={{ color: colors.textOnPrimary, fontWeight: '700' }}>
              Apply
            </Text>
          </Pressable>
        </View>
      </View>
    </AppSheetModal>
  );
}
