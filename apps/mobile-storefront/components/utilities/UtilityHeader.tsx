import Ionicons from '@react-native-vector-icons/ionicons';
import type React from 'react';
import { Pressable, Text, View } from 'react-native';
import { utilityPurchaseStyles as styles } from '@/components/utilities/utility-purchase.styles';

type UtilityHeaderIconName = React.ComponentProps<typeof Ionicons>['name'];

const MIN_PADDING_TOP = 12;
const BACK_ICON_NAME: UtilityHeaderIconName = 'chevron-back';
const BACK_ICON_SIZE = 22;
const HISTORY_ICON_NAME: UtilityHeaderIconName = 'document-text-outline';
const HISTORY_ICON_SIZE = 20;

interface UtilityHeaderProps {
  title: string;
  onBack: () => void;
  onHistory?: () => void;
  titleColor: string;
  dividerColor: string;
  iconBackgroundColor: string;
  iconColor: string;
  /** Color for the history (receipt) icon; defaults to iconColor. */
  historyIconColor?: string;
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
  historyIconColor,
  topInset,
  surfaceColor,
}: UtilityHeaderProps): React.ReactElement {
  // We apply a +6pt additional spacing to topInset to visually offset the header
  // from the safe-area notch and to match the tab bar height offset used elsewhere.
  // This ensures a balanced top spacing across devices relative to MIN_PADDING_TOP.
  const paddingTop = Math.max(topInset + 6, MIN_PADDING_TOP);

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: surfaceColor,
          borderBottomColor: dividerColor,
          paddingTop,
          paddingBottom: 8,
          minHeight: paddingTop + 44 + 8,
        },
      ]}
    >
      <View
        style={[
          styles.headerSide,
          {
            top: paddingTop,
            height: 44,
          },
        ]}
      >
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
            <Ionicons
              name={BACK_ICON_NAME}
              size={BACK_ICON_SIZE}
              color={iconColor}
              style={{ marginRight: -1.5 }}
            />
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

      <View
        style={[
          styles.headerSideRight,
          {
            top: paddingTop,
            height: 44,
          },
        ]}
      >
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
                name={HISTORY_ICON_NAME}
                size={HISTORY_ICON_SIZE}
                color={historyIconColor ?? iconColor}
              />
            </View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
