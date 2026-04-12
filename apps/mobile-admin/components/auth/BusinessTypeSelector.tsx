import {
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import {
  BUSINESS_TYPES,
  type BusinessTypeId,
} from '@/constants/business-types';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

interface BusinessTypeSelectorProps {
  accessibilityLabelSuffix?: string;
  borderColor: string;
  cardBackgroundColor: string;
  onSelect: (typeId: BusinessTypeId) => void;
  selectedBackgroundColor: string;
  selectedBorderColor: string;
  selectedTextColor: string;
  selectedType: string;
  textColor: string;
  cardStyle?: ViewStyle;
  selectedCardStyle?: ViewStyle;
  selectedTextStyle?: TextStyle;
  textStyle?: TextStyle;
}

export function BusinessTypeSelector({
  accessibilityLabelSuffix = 'business type',
  borderColor,
  cardBackgroundColor,
  cardStyle,
  onSelect,
  selectedBackgroundColor,
  selectedBorderColor,
  selectedCardStyle,
  selectedTextColor,
  selectedTextStyle,
  selectedType,
  textColor,
  textStyle,
}: BusinessTypeSelectorProps) {
  return (
    <View style={styles.typeGrid}>
      {BUSINESS_TYPES.map((type) => {
        const isSelected = selectedType === type.id;

        return (
          <Pressable
            key={type.id}
            accessibilityRole="button"
            accessibilityLabel={`${type.label} ${accessibilityLabelSuffix}`}
            accessibilityState={{ selected: isSelected }}
            style={[
              styles.typeCard,
              { borderColor, backgroundColor: cardBackgroundColor },
              cardStyle,
              isSelected && [
                styles.typeCardSelected,
                {
                  backgroundColor: selectedBackgroundColor,
                  borderColor: selectedBorderColor,
                },
                selectedCardStyle,
              ],
            ]}
            onPress={() => onSelect(type.id)}
          >
            <Text
              style={[
                styles.typeText,
                { color: textColor },
                textStyle,
                isSelected && [
                  styles.typeTextSelected,
                  { color: selectedTextColor },
                  selectedTextStyle,
                ],
              ]}
            >
              {type.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  typeCard: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  typeCardSelected: {},
  typeText: {
    fontSize: TYPOGRAPHY.size.sm,
  },
  typeTextSelected: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
