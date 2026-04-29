import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { utilityPurchaseStyles as styles } from '@/app/utilities/utility-purchase.styles';

const TOP_INSET_OFFSET = 10;
const MIN_PADDING_TOP = 12;

interface UtilityHeaderProps {
  title: string;
  onBack: () => void;
  onHistory?: () => void;
  titleColor: string;
  dividerColor: string;
  iconBackgroundColor: string;
  iconColor: string;
  topInset: number;
  surfaceColor: string;
}

export function UtilityHeader({
  title,
  onBack,
  onHistory,
  titleColor,
  dividerColor,
  iconBackgroundColor,
  iconColor,
  topInset,
  surfaceColor,
}: UtilityHeaderProps) {
  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: surfaceColor,
          borderBottomColor: dividerColor,
          paddingTop: Math.max(topInset - TOP_INSET_OFFSET, MIN_PADDING_TOP),
        },
      ]}
    >
      <View style={styles.headerSide}>
        <Pressable
          style={styles.headerIconButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <View
            style={[
              styles.headerIconCircle,
              { backgroundColor: iconBackgroundColor },
            ]}
          >
            <Ionicons name="chevron-back" size={31} color={iconColor} />
          </View>
        </Pressable>
      </View>

      <View style={styles.headerTitleWrap}>
        <Text
          style={[styles.headerTitle, { color: titleColor }]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>

      <View style={[styles.headerSide, styles.headerSideRight]}>
        {onHistory ? (
          <Pressable
            style={styles.headerIconButton}
            onPress={onHistory}
            accessibilityRole="button"
            accessibilityLabel="View utility history"
          >
            <View
              style={[
                styles.headerIconCircle,
                { backgroundColor: iconBackgroundColor },
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={25}
                color={iconColor}
              />
            </View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
