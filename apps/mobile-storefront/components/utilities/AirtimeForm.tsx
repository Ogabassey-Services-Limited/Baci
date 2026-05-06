import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
import { airtimeFormStyles as styles } from './airtime-form.styles';
import type { AirtimeFormProps } from './airtime-form.types';
import { ProviderGrid } from './ProviderGrid';
import { UtilityPaymentOptions } from './UtilityPaymentOptions';
import { useAirtimeFormController } from './use-airtime-form-controller';

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

export function AirtimeForm(props: AirtimeFormProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const form = useAirtimeFormController(props);
  const shouldShowSelectedNetwork =
    Boolean(form.selectedProvider) && !form.isNetworkPickerExpanded;
  const shouldShowManualNetworkPicker = form.isNetworkPickerExpanded;

  return (
    <>
      <ScrollView
        ref={form.scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: form.footerSpacerHeight },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Phone Number
        </Text>

        <View style={styles.inputGroup}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.muted,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="08012345678"
            placeholderTextColor={colors.placeholder}
            keyboardType="phone-pad"
            value={form.phoneNumber}
            onChangeText={form.handlePhoneChange}
          />
        </View>

        {shouldShowSelectedNetwork ? (
          <View
            style={[
              styles.selectedNetworkCard,
              {
                backgroundColor: `${BRAND.primary}10`,
                borderColor: BRAND.primary,
              },
            ]}
          >
            {form.selectedProviderConfig ? (
              <Image
                source={form.selectedProviderConfig.image}
                style={styles.selectedNetworkLogo}
                resizeMode="contain"
                accessibilityLabel={`${form.selectedProviderConfig.name} logo`}
              />
            ) : null}
            <View style={styles.selectedNetworkCopy}>
              <Text
                style={[
                  styles.selectedNetworkLabel,
                  { color: colors.textSecondary },
                ]}
              >
                Network
              </Text>
              <Text
                style={[styles.selectedNetworkName, { color: colors.text }]}
              >
                {form.selectedProviderConfig?.name ?? form.selectedProvider}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change selected network"
              onPress={() => form.setIsNetworkPickerExpanded(true)}
              style={[styles.changeButton, { borderColor: BRAND.primary }]}
            >
              <Text style={styles.changeButtonText}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.networkPicker}>
            <View style={styles.networkPickerHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Select Network
              </Text>
              {!shouldShowManualNetworkPicker ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose network manually"
                  onPress={() => form.setIsNetworkPickerExpanded(true)}
                  style={[styles.inlineButton, { borderColor: colors.border }]}
                >
                  <Text
                    style={[styles.inlineButtonText, { color: colors.text }]}
                  >
                    Choose manually
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {shouldShowManualNetworkPicker ? (
              <ProviderGrid
                selectedProvider={form.selectedProvider}
                onSelect={form.handleProviderSelect}
              />
            ) : null}
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Amount (₦)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.muted,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="1,000"
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
            value={form.formattedAmount}
            onChangeText={(text) => form.setAmount(text.replace(/\D/g, ''))}
          />
          <View style={styles.quickAmounts}>
            {QUICK_AMOUNTS.map((amount) => {
              const isSelectedAmount = form.numericAmount === amount;

              return (
                <Pressable
                  key={amount}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelectedAmount }}
                  style={[
                    styles.quickChip,
                    {
                      backgroundColor: isSelectedAmount
                        ? BRAND.primary
                        : colors.background,
                      borderColor: isSelectedAmount
                        ? BRAND.primary
                        : colors.border,
                    },
                  ]}
                  onPress={() => form.setAmount(String(amount))}
                >
                  <Text
                    style={[
                      styles.quickChipText,
                      {
                        color: isSelectedAmount ? BRAND.onPrimary : colors.text,
                      },
                    ]}
                  >
                    ₦{amount.toLocaleString()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View onLayout={form.handlePaymentLayout}>
          <UtilityPaymentOptions
            amount={form.numericAmount}
            cards={form.payment.cards}
            isLoadingCards={form.payment.isLoadingCards}
            onSelectGateway={form.payment.selectGateway}
            onSelectSavedCard={form.payment.selectSavedCard}
            selectedGateway={form.payment.selectedGateway}
            selectedSavedCardId={form.payment.selectedSavedCardId}
            supportedGateways={form.payment.supportedGateways}
            walletBalance={form.payment.walletBalance}
            walletSelection={form.payment.walletSelection}
            onWalletToggle={form.payment.setWalletSelection}
          />
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.muted,
            bottom: form.footerBottomOffset,
            paddingBottom: form.isKeyboardVisible
              ? SPACING.sm
              : Math.max(form.insets.bottom, SPACING.md),
          },
        ]}
      >
        <Pressable
          style={[
            styles.payButton,
            {
              backgroundColor: BRAND.primary,
              opacity: form.isSubmitting ? 0.7 : 1,
            },
          ]}
          onPress={form.handlePurchase}
          disabled={form.isSubmitting}
        >
          {form.isSubmitting ? (
            <ActivityIndicator color={BRAND.onPrimary} />
          ) : (
            <Text style={styles.payButtonText}>
              {form.payment.selectedSavedCardId
                ? `Pay ₦${form.numericAmount ? form.numericAmount.toLocaleString() : '0'}`
                : 'Continue to Payment'}
            </Text>
          )}
        </Pressable>
      </View>
    </>
  );
}
