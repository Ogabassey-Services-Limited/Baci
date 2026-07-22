import { Text, View } from 'react-native';
import { negotiationCardStyles as styles } from './NegotiationCard.styles';

interface NegotiationItemMetaChipsColors {
  backgroundLight: string;
  border: string;
  text: string;
  textSecondary: string;
}

interface NegotiationItemMetaChipsProps {
  colors: NegotiationItemMetaChipsColors;
  compact?: boolean;
  metadata: string;
}

function splitMetadataPart(part: string): { label: string; value: string } {
  const separatorIndex = part.indexOf(':');
  if (separatorIndex === -1) {
    return { label: 'Variant', value: part };
  }

  return {
    label: part.slice(0, separatorIndex).trim(),
    value: part.slice(separatorIndex + 1).trim(),
  };
}

export function NegotiationItemMetaChips({
  colors,
  compact = false,
  metadata,
}: NegotiationItemMetaChipsProps) {
  const parts = metadata.split(' · ').map(splitMetadataPart);

  return (
    <View
      style={[
        styles.itemMetaChips,
        compact ? styles.itemMetaChipsCompact : styles.itemMetaChipsCard,
      ]}
      accessible={true}
      accessibilityLabel={`Selected options: ${metadata.replaceAll(' · ', ', ')}`}
    >
      {parts.map(({ label, value }) => (
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
