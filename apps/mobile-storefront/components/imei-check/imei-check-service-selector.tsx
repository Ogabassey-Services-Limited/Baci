import {
  IMEI_SERVICE_TIERS,
  type ImeiServiceTierDefinition,
  type ImeiServiceTierKey,
} from '@baci/shared/imei';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Alert, Pressable, Text, View } from 'react-native';
import { BRAND, withAlpha } from '@/constants/Colors';
import { formatServicePrice } from './format-service-price';
import { styles } from './imei-check.styles';
import type { ImeiCheckerColors } from './imei-check.types';

interface ImeiCheckServiceSelectorProps {
  colors: ImeiCheckerColors;
  displayedTierKeys: readonly ImeiServiceTierKey[];
  selectedTier: ImeiServiceTierKey;
  canToggleServices: boolean;
  showAllServices: boolean;
  onTierSelect: (tier: ImeiServiceTierKey) => void;
  onToggleServices: () => void;
}

export function ImeiCheckServiceSelector({
  colors,
  displayedTierKeys,
  selectedTier,
  canToggleServices,
  showAllServices,
  onTierSelect,
  onToggleServices,
}: ImeiCheckServiceSelectorProps) {
  return (
    <>
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
    </>
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
      <Ionicons
        name={tier.icon}
        size={22}
        color={isSelected ? BRAND.primary : colors.textSecondary}
        style={styles.tierIcon}
      />
      <View style={styles.tierBody}>
        <View style={styles.tierNameRow}>
          <Text
            style={[
              styles.tierName,
              { color: isSelected ? BRAND.primary : colors.text },
            ]}
            numberOfLines={1}
          >
            {tier.name}
          </Text>
          {tier.recommended && (
            <View style={styles.recommendedBadge}>
              <Ionicons name="star" size={9} color={BRAND.onPrimary} />
              <Text style={styles.recommendedText}>BEST</Text>
            </View>
          )}
        </View>
        <Text
          style={[styles.tierTagline, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {tier.tagline}
        </Text>
      </View>
      <Text
        style={[
          styles.tierPrice,
          { color: isSelected ? BRAND.primary : colors.text },
        ]}
      >
        {formatServicePrice(tier.price)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`What ${tier.name} includes`}
        hitSlop={8}
        onPress={() =>
          Alert.alert(
            tier.name,
            `${tier.detail}\n\nIncludes: ${tier.features.join(' · ')}`
          )
        }
        style={styles.tierInfoButton}
      >
        <Ionicons
          name="information-circle-outline"
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>
    </Pressable>
  );
}
