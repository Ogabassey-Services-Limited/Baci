import Ionicons from "@react-native-vector-icons/ionicons/static";
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { styles } from './styles';
import type { TaxCardShadow, TaxColors } from './types';

interface VatCardProps {
  colors: TaxColors;
  shadowStyle: TaxCardShadow;
  vatEnabled: boolean;
  isPending: boolean;
  onToggle: () => void;
}

export function VatCard({
  colors,
  shadowStyle,
  vatEnabled,
  isPending,
  onToggle,
}: VatCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card }, shadowStyle]}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: vatEnabled
                ? colors.successLight
                : colors.cardHover,
            },
          ]}
        >
          <Ionicons
            name="receipt-outline"
            size={24}
            color={vatEnabled ? colors.success : colors.textSecondary}
          />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            VAT Collection
          </Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: vatEnabled
                  ? colors.successLight
                  : colors.cardHover,
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: vatEnabled
                    ? colors.success
                    : colors.textMuted,
                },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: vatEnabled ? colors.success : colors.textMuted },
              ]}
            >
              {vatEnabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <Pressable
        style={styles.toggleRow}
        onPress={onToggle}
        disabled={isPending}
      >
        <View style={styles.toggleInfo}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>
            Charge 7.5% VAT
          </Text>
          <Text
            style={[styles.toggleDescription, { color: colors.textSecondary }]}
          >
            Applied to all orders at checkout
          </Text>
        </View>
        <View style={styles.toggleContainer}>
          {isPending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <View
              style={[
                styles.toggle,
                vatEnabled && styles.toggleActive,
                {
                  backgroundColor: vatEnabled
                    ? colors.success
                    : colors.cardHover,
                },
              ]}
            >
              <View
                style={[
                  styles.toggleThumb,
                  vatEnabled && styles.toggleThumbActive,
                  { backgroundColor: colors.backgroundLight },
                ]}
              />
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
}
