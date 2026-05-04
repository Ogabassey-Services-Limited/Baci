import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { BRAND, palette } from '@/constants/Colors';
import type { ThemeColors } from '@/types/theme';
import {
  ADDRESS_EMPTY_ADD_ACTION_LABEL,
  ADDRESS_EMPTY_SUBTITLE,
  ADDRESS_EMPTY_TITLE,
} from './constants';
import { styles } from './styles';

type AddressEmptyStateProps = {
  colors: ThemeColors;
  onAddPress: () => void;
};

export function AddressEmptyState({
  colors,
  onAddPress,
}: AddressEmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <Ionicons
        name="location-outline"
        size={64}
        color={colors.textSecondary}
        accessible={false}
        importantForAccessibility="no"
      />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {ADDRESS_EMPTY_TITLE}
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {ADDRESS_EMPTY_SUBTITLE}
      </Text>
      <Pressable
        style={[styles.addButton, { backgroundColor: BRAND.primary }]}
        onPress={onAddPress}
        accessibilityRole="button"
        accessibilityLabel={ADDRESS_EMPTY_ADD_ACTION_LABEL}
      >
        <Ionicons
          name="add"
          size={20}
          color={palette.white}
          accessible={false}
          importantForAccessibility="no"
        />
        <Text style={styles.addButtonText}>
          {ADDRESS_EMPTY_ADD_ACTION_LABEL}
        </Text>
      </Pressable>
    </View>
  );
}
