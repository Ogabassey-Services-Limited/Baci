import { Text, View } from 'react-native';
import { negotiationCardStyles as styles } from './NegotiationCard.styles';
import type { NegotiationItemMetaPart } from './negotiation-item-meta.types';

interface NegotiationItemMetaChipsColors {
  backgroundLight: string;
  border: string;
  text: string;
  textSecondary: string;
}

interface NegotiationItemMetaChipsProps {
  colors: NegotiationItemMetaChipsColors;
  compact?: boolean;
  metadata: readonly NegotiationItemMetaPart[];
}

export function NegotiationItemMetaChips({
  colors,
  compact = false,
  metadata,
}: NegotiationItemMetaChipsProps) {
  const accessibilitySummary = metadata
    .map(({ label, value }) => `${label}: ${value}`)
    .join(', ');

  return (
    <View
      style={[
        styles.itemMetaChips,
        compact ? styles.itemMetaChipsCompact : styles.itemMetaChipsCard,
      ]}
      accessible={true}
      accessibilityLabel={`Selected options: ${accessibilitySummary}`}
    >
      {metadata.map(({ label, value }) => (
        <View
          key={`${label}:${value}`}
          style={[
            styles.itemMetaChip,
            {
              backgroundColor: colors.backgroundLight,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[styles.itemMetaChipLabel, { color: colors.textSecondary }]}
          >
            {label}
          </Text>
          <Text style={[styles.itemMetaChipValue, { color: colors.text }]}>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}
