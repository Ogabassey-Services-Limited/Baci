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
import { BRAND, withAlpha } from '@/constants/Colors';
import { formatServicePrice } from './format-service-price';
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
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom', 'left', 'right']}
    >
      <Stack.Screen
        options={{
          title: 'IMEI Checker',
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
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
              (isLoading || imei.length < 15) && styles.verifyButtonDisabled,
            ]}
            onPress={onCheck}
            disabled={isLoading || imei.length < 15}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.verifyButtonText}>
                  Verify Now - {formatServicePrice(currentTier.price)}
                </Text>
                <Ionicons name="sparkles" size={18} color="#FFF" />
              </>
            )}
          </Pressable>
        </View>
      </AppKeyboardContainer>
    </SafeAreaView>
  );
}

function HeroCard({ colors }: { colors: ImeiCheckerColors }) {
  return (
    <View
      style={[
        styles.heroCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.heroHeader}>
        <View
          style={[
            styles.heroIcon,
            { backgroundColor: withAlpha(BRAND.primary, 0.1) },
          ]}
        >
          <Ionicons name="barcode-outline" size={24} color={BRAND.primary} />
        </View>
        <View style={styles.heroCopy}>
          <Text
            style={[styles.heroEyebrow, { color: BRAND.primary }]}
            numberOfLines={1}
          >
            Device verification
          </Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            IMEI Checker
          </Text>
        </View>
      </View>
      <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
        Check blacklist, iCloud and SIM lock status before you pay.
      </Text>
      <View style={styles.trustIndicators}>
        {['15-digit check', 'Official status', 'Instant report'].map((item) => (
          <View
            key={item}
            style={[
              styles.trustPill,
              { backgroundColor: withAlpha(BRAND.primary, 0.06) },
            ]}
          >
            <Ionicons name="checkmark" size={12} color="#059669" />
            <Text style={[styles.trustText, { color: colors.textSecondary }]}>
              {item}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
