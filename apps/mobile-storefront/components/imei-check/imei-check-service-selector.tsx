import {
  IMEI_BRAND_FILTERS,
  IMEI_SERVICE_TIERS,
  type ImeiBrandFilter,
  type ImeiServiceTierDefinition,
  type ImeiServiceTierKey,
} from '@baci/shared/imei';
import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Pressable, Text, View } from 'react-native';
import { BRAND, withAlpha } from '@/constants/Colors';
import { formatServicePrice } from './format-service-price';
import { styles } from './imei-check.styles';
import type { ImeiCheckerColors } from './imei-check.types';

interface ImeiCheckServiceSelectorProps {
  colors: ImeiCheckerColors;
  currentTier: ImeiServiceTierDefinition;
  displayedTierKeys: readonly ImeiServiceTierKey[];
  selectedBrand: ImeiBrandFilter;
  selectedTier: ImeiServiceTierKey;
  canToggleServices: boolean;
  showAllServices: boolean;
  onBrandSelect: (brand: ImeiBrandFilter) => void;
  onTierSelect: (tier: ImeiServiceTierKey) => void;
  onToggleServices: () => void;
}

export function ImeiCheckServiceSelector({
  colors,
  currentTier,
  displayedTierKeys,
  selectedBrand,
  selectedTier,
  canToggleServices,
  showAllServices,
  onBrandSelect,
  onTierSelect,
  onToggleServices,
}: ImeiCheckServiceSelectorProps) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Report type
        </Text>
        <Text style={[styles.sectionMeta, { color: colors.textSecondary }]}>
          {currentTier.name} - {formatServicePrice(currentTier.price)}
        </Text>
      </View>

      <View style={styles.brandFilterRow}>
        {IMEI_BRAND_FILTERS.map((brand) => (
          <BrandChip
            key={brand.id}
            colors={colors}
            isSelected={selectedBrand === brand.id}
            label={brand.label}
            onPress={() => onBrandSelect(brand.id)}
          />
        ))}
      </View>

      <View style={styles.tierGrid}>
        {displayedTierKeys.map((tierKey) => (
          <TierCard
            key={tierKey}
            colors={colors}
            isSelected={selectedTier === tierKey}
            tier={IMEI_SERVICE_TIERS[tierKey]}
            onPress={() => onTierSelect(tierKey)}
          />
        ))}
      </View>

      {canToggleServices && (
        <Pressable
          style={[
            styles.expandServicesButton,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={onToggleServices}
        >
          <Text style={[styles.expandServicesText, { color: colors.text }]}>
            {showAllServices ? 'Show key checks' : 'Show all services'}
          </Text>
          <Ionicons
            name={showAllServices ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textSecondary}
          />
        </Pressable>
      )}

      <View
        style={[
          styles.featuresContainer,
          {
            backgroundColor: withAlpha(BRAND.primary, 0.04),
            borderColor: withAlpha(BRAND.primary, 0.12),
          },
        ]}
      >
        <Text style={[styles.featuresLabel, { color: colors.text }]}>
          Included in {currentTier.name}
        </Text>
        <Text style={[styles.featuresDetail, { color: colors.textSecondary }]}>
          {currentTier.detail}
        </Text>
        <View style={styles.featuresList}>
          {currentTier.features.map((feature) => (
            <View
              key={feature}
              style={[
                styles.featureTag,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name="checkmark" size={12} color="#059669" />
              <Text
                style={[styles.featureText, { color: colors.textSecondary }]}
              >
                {feature}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );
}

function BrandChip({
  colors,
  isSelected,
  label,
  onPress,
}: {
  colors: ImeiCheckerColors;
  isSelected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.brandFilterChip,
        {
          backgroundColor: isSelected
            ? withAlpha(BRAND.primary, 0.1)
            : colors.card,
          borderColor: isSelected ? BRAND.primary : colors.border,
        },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.brandFilterText,
          { color: isSelected ? BRAND.primary : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TierCard({
  colors,
  isSelected,
  onPress,
  tier,
}: {
  colors: ImeiCheckerColors;
  isSelected: boolean;
  onPress: () => void;
  tier: ImeiServiceTierDefinition;
}) {
  return (
    <Pressable
      style={[
        styles.tierCard,
        {
          backgroundColor: isSelected
            ? withAlpha(BRAND.primary, 0.08)
            : colors.card,
          borderColor: isSelected ? BRAND.primary : colors.border,
        },
      ]}
      onPress={onPress}
    >
      {tier.recommended && (
        <View style={styles.recommendedBadge}>
          <Ionicons name="star" size={10} color="#FFF" />
          <Text style={styles.recommendedText}>BEST</Text>
        </View>
      )}
      <Ionicons
        name={tier.icon}
        size={24}
        color={isSelected ? BRAND.primary : colors.textSecondary}
      />
      <Text
        style={[
          styles.tierName,
          { color: isSelected ? BRAND.primary : colors.text },
        ]}
      >
        {tier.name}
      </Text>
      <Text style={[styles.tierTagline, { color: colors.textSecondary }]}>
        {tier.tagline}
      </Text>
      <Text
        style={[
          styles.tierPrice,
          { color: isSelected ? BRAND.primary : colors.text },
        ]}
      >
        {formatServicePrice(tier.price)}
      </Text>
    </Pressable>
  );
}
