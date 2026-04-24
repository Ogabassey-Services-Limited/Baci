import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export interface AppPageSheetProps {
  children: ReactNode;
  closeLabel?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
  onClose: () => void;
  scrollEnabled?: boolean;
  title: string;
  trailingAccessory?: ReactNode;
  visible: boolean;
}

export function AppPageSheet({
  children,
  closeLabel = 'Close sheet',
  contentContainerStyle,
  footer,
  onClose,
  scrollEnabled = true,
  title,
  trailingAccessory,
  visible,
}: AppPageSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const content = scrollEnabled ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.content}
      testID="app-page-sheet-scroll"
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[styles.content, styles.staticContent, contentContainerStyle]}
      testID="app-page-sheet-static"
    >
      {children}
    </View>
  );

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
              paddingTop: Math.max(insets.top, SPACING.md),
            },
          ]}
        >
          <View style={styles.headerSide}>
            <Pressable
              accessibilityLabel={closeLabel}
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [
                styles.headerButton,
                { backgroundColor: colors.backgroundLight },
                pressed && { opacity: 0.7 }
              ]}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={[styles.title, { color: colors.text }]}
          >
            {title}
          </Text>
          <View style={styles.headerSideRight}>{trailingAccessory}</View>
        </View>

        {content}

        {footer ? (
          <View
            style={[
              styles.footer,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, SPACING.md),
              },
            ]}
          >
            {footer}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  headerSide: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 48,
  },
  headerSideRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 48,
  },
  headerButton: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  title: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.lg,
    paddingHorizontal: SPACING.md,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
  },
  staticContent: {
    padding: SPACING.lg,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
});
