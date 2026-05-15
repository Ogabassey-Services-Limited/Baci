import type {
  ImeiBrandFilter,
  ImeiServiceTierDefinition,
  ImeiServiceTierKey,
} from '@baci/shared/imei';
import { Ionicons } from '@expo/vector-icons';
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
import HeroCard from './imei-check-hero-card';
import { styles } from './imei-check.styles';
import type { ImeiCheckerColors } from './imei-check.types';
import { ImeiCheckInputSection } from './imei-check-input-section';
import { ImeiCheckServiceSelector } from './imei-check-service-selector';

interface ImeiCheckFormViewProps {
  colors: ImeiCheckerColors;
  currentTier: ImeiServiceTierDefinition;
  displayedTierKeys: readonly ImeiServiceTierKey[];
  error: string | null;
  imei: string;
  isLoading: boolean;
  selectedBrand: ImeiBrandFilter;
  selectedTier: ImeiServiceTierKey;
  showAllServices: boolean;
  onBrandSelect: (brand: ImeiBrandFilter) => void;
  onChangeImei: (value: string) => void;
  onCheck: () => void;
  onClearImei: () => void;
  onTierSelect: (tier: ImeiServiceTierKey) => void;
  onToggleServices: () => void;
}

export function ImeiCheckFormView({
  colors,
  currentTier,
  displayedTierKeys,
  error,
  imei,
  isLoading,
  selectedBrand,
  selectedTier,
  showAllServices,
  onBrandSelect,
  onChangeImei,
  onCheck,
  onClearImei,
  onTierSelect,
  onToggleServices,
}: ImeiCheckFormViewProps) {
  const canVerify = isValidIMEI(imei);

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
            {isLoading ? (
              <ActivityIndicator color={BRAND.onPrimary} />
            ) : (
              <>
                <Text style={styles.verifyButtonText}>
                  Verify Now - {formatServicePrice(currentTier.price)}
                </Text>
                <Ionicons
                  name="sparkles"
                  size={18}
                  color={BRAND.onPrimary}
                />
              </>
            )}
          </Pressable>
        </View>
      </AppKeyboardContainer>
    </SafeAreaView>
  );
}
