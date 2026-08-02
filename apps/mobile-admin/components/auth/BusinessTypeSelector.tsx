import Ionicons, {
  type IoniconsIconName,
} from '@react-native-vector-icons/ionicons';
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

const BUSINESS_TYPE_ICONS: Record<BusinessTypeId, IoniconsIconName> = {
  fashion: 'shirt-outline',
  electronics: 'phone-portrait-outline',
  'home-goods': 'home-outline',
  'health-beauty': 'sparkles-outline',
  handmade: 'color-palette-outline',
  'food-beverage': 'restaurant-outline',
  'hair-extensions': 'cut-outline',
  pharmaceuticals: 'medkit-outline',
  other: 'ellipsis-horizontal',
};

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
          <View key={type.id} style={styles.typeCardFrame}>
            <Pressable
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
              <View
                style={[
                  styles.typeIcon,
                  {
                    borderColor: isSelected ? selectedBorderColor : borderColor,
                  },
                ]}
              >
                <Ionicons
                  color={isSelected ? selectedBorderColor : textColor}
                  name={BUSINESS_TYPE_ICONS[type.id]}
                  size={18}
                />
              </View>
              <Text
                numberOfLines={2}
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
              {isSelected ? (
                <Ionicons
                  color={selectedBorderColor}
                  name="checkmark-circle"
                  size={18}
                  style={styles.selectedIndicator}
                />
              ) : null}
            </Pressable>
          </View>
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
  typeCardFrame: {
    flexGrow: 1,
    minHeight: 70,
    width: '48%',
  },
  typeCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    flex: 1,
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    position: 'relative',
  },
  typeCardSelected: {
    paddingRight: 28,
  },
  typeIcon: {
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  typeText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
    lineHeight: 17,
  },
  typeTextSelected: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  selectedIndicator: {
    position: 'absolute',
    right: 6,
    top: 6,
  },
});
