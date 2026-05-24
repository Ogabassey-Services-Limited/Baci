import type {
  ImeiBrandFilter,
  ImeiServiceTierDefinition,
  ImeiServiceTierKey,
} from '@baci/shared/imei';
import Ionicons from "@react-native-vector-icons/ionicons/static";
import { router, Stack } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppKeyboardContainer from '@/components/ui/AppKeyboardContainer';
import { BRAND } from '@/constants/Colors';
import { isValidIMEI } from '@/lib/validation/commerce-schemas';
import { formatServicePrice } from './format-service-price';
import { styles } from './imei-check.styles';
import type { ImeiCheckerColors } from './imei-check.types';
import HeroCard from './imei-check-hero-card';
import { ImeiCheckInputSection } from './imei-check-input-section';
import { ImeiCheckServiceSelector } from './imei-check-service-selector';
import { ImeiInsufficientBalanceCta } from './imei-insufficient-balance-cta';

interface ImeiCheckFormViewProps {
  colors: ImeiCheckerColors;
  currentTier: ImeiServiceTierDefinition;
  displayedTierKeys: readonly ImeiServiceTierKey[];
  error: string | null;
  imei: string;
  isLoading: boolean;
  isWalletError: boolean;
  isWalletLoading: boolean;
  selectedBrand: ImeiBrandFilter;
  selectedTier: ImeiServiceTierKey;
  canToggleServices: boolean;
  showAllServices: boolean;
  walletBalance: number;
  onBrandSelect: (brand: ImeiBrandFilter) => void;
  onChangeImei: (value: string) => void;
  onCheck: () => void;
  onClearImei: () => void;
  onTierSelect: (tier: ImeiServiceTierKey) => void;
  onTopUpWallet: (amount: number) => void;
  onToggleServices: () => void;
}

export function ImeiCheckFormView({
  colors,
  currentTier,
  displayedTierKeys,
  error,
  imei,
  isLoading,
  isWalletError,
  isWalletLoading,
  selectedBrand,
  selectedTier,
  canToggleServices,
  showAllServices,
  walletBalance,
  onBrandSelect,
  onChangeImei,
  onCheck,
  onClearImei,
  onTierSelect,
  onTopUpWallet,
  onToggleServices,
}: ImeiCheckFormViewProps) {
  const isWalletReady = !(isWalletLoading || isWalletError);
  const hasEnoughBalance = isWalletReady && walletBalance >= currentTier.price;
  const canVerify = isValidIMEI(imei) && hasEnoughBalance;
  const walletStatusText = isWalletLoading
    ? 'Loading wallet balance...'
    : isWalletError
      ? 'Wallet balance unavailable. Refresh your wallet and try again.'
      : null;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom', 'left', 'right']}
    >
      <Stack.Screen
        options={{
          title: 'IMEI Checker',
          headerLeft: () => (
            <Pressable
              accessibilityHint="Returns to the previous screen"
              accessibilityLabel="Back"
              accessibilityRole="button"
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <AppKeyboardContainer style={styles.keyboardView}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <HeroCard colors={colors} />
          <ImeiCheckServiceSelector
            colors={colors}
            currentTier={currentTier}
            displayedTierKeys={displayedTierKeys}
            selectedBrand={selectedBrand}
            selectedTier={selectedTier}
            canToggleServices={canToggleServices}
            showAllServices={showAllServices}
            onBrandSelect={onBrandSelect}
            onTierSelect={onTierSelect}
            onToggleServices={onToggleServices}
          />
          <ImeiCheckInputSection
            colors={colors}
            error={error}
            imei={imei}
            onChangeImei={onChangeImei}
            onCheck={onCheck}
            onClearImei={onClearImei}
          />
          {walletStatusText ? (
            <View
              style={[
                styles.errorContainer,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name="wallet-outline"
                size={18}
                color={colors.textSecondary}
              />
              <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                {walletStatusText}
              </Text>
            </View>
          ) : !hasEnoughBalance ? (
            <ImeiInsufficientBalanceCta
              balance={walletBalance}
              colors={colors}
              requiredAmount={currentTier.price}
              onTopUp={onTopUpWallet}
            />
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.bottomAction,
            { backgroundColor: colors.card, borderTopColor: colors.border },
          ]}
        >
          <Pressable
            style={[
              styles.verifyButton,
              { backgroundColor: BRAND.primary },
              (isLoading || !canVerify) && styles.verifyButtonDisabled,
            ]}
            onPress={onCheck}
            disabled={isLoading || !canVerify}
          >
            <View
              style={[styles.walletBalancePill, { borderColor: colors.border }]}
            >
              <Text
                style={[styles.walletBalanceText, { color: BRAND.onPrimary }]}
              >
                Balance {formatServicePrice(walletBalance)}
              </Text>
            </View>
            {isLoading ? (
              <ActivityIndicator color={BRAND.onPrimary} />
            ) : (
              <>
                <Text style={styles.verifyButtonText}>
                  {isWalletLoading
                    ? 'Loading wallet...'
                    : isWalletError
                      ? 'Wallet unavailable'
                      : hasEnoughBalance
                        ? `Verify Now - ${formatServicePrice(currentTier.price)}`
                        : 'Top up to unlock'}
                </Text>
                <Ionicons name="sparkles" size={18} color={BRAND.onPrimary} />
              </>
            )}
          </Pressable>
        </View>
      </AppKeyboardContainer>
    </SafeAreaView>
  );
}
