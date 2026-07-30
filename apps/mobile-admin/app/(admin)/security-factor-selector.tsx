import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { securityStyles as styles } from './security-styles';

export type VerifiedTotpFactor = { id: string; name: string };

interface SecurityFactorSelectorProps {
  factors: VerifiedTotpFactor[];
  onSelect: (factorId: string) => void;
  selectedFactorId: string | null;
}

export function SecurityFactorSelector({
  factors,
  onSelect,
  selectedFactorId,
}: SecurityFactorSelectorProps) {
  const { colors } = useTheme();

  if (factors.length <= 1) return null;

  return (
    <View accessibilityRole="radiogroup">
      <Text style={[styles.label, { color: colors.text }]}>
        Choose an authenticator
      </Text>
      {factors.map((factor) => {
        const selected = factor.id === selectedFactorId;

        return (
          <Pressable
            accessibilityLabel={`Use ${factor.name}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={factor.id}
            onPress={() => onSelect(factor.id)}
            style={[
              styles.secondaryButton,
              {
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={[styles.link, { color: colors.text }]}>
              {factor.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
