import Ionicons from '@react-native-vector-icons/ionicons';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  floatingFooter?: ReactNode;
  floatingFooterContainerStyle?: StyleProp<ViewStyle>;
  onClose: () => void;
  scrollEnabled?: boolean;
  sheetContainerStyle?: StyleProp<ViewStyle>;
  title: string;
  trailingAccessory?: ReactNode;
  visible: boolean;
}

export function AppPageSheet({
  children,
  closeLabel = 'Close sheet',
  contentContainerStyle,
  footer,
  floatingFooter,
  floatingFooterContainerStyle,
  onClose,
  scrollEnabled = true,
  sheetContainerStyle,
  title,
  trailingAccessory,
  visible,
}: AppPageSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const content = scrollEnabled ? (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        contentContainerStyle,
        !footer && { paddingBottom: Math.max(insets.bottom, SPACING.md) },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.content}
      testID="app-page-sheet-scroll"
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.content,
        styles.staticContent,
        contentContainerStyle,
        !footer && { paddingBottom: Math.max(insets.bottom, SPACING.md) },
      ]}
      testID="app-page-sheet-static"
    >
      {children}
    </View>
  );

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent={true}
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        {/* Backdrop (Tapping here closes the sheet) */}
        <Pressable
          accessibilityLabel="Close sheet backdrop"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        {/* Sheet container */}
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              borderTopLeftRadius: RADIUS.xl,
              borderTopRightRadius: RADIUS.xl,
              paddingBottom: 0,
            },
            sheetContainerStyle,
          ]}
          testID="app-page-sheet-container"
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View
              style={[styles.handle, { backgroundColor: colors.textMuted }]}
            />
          </View>

          {/* Header */}
          <View
            style={[
              styles.header,
              {
                backgroundColor: colors.card,
                borderBottomColor: colors.border,
                paddingTop: SPACING.md,
                paddingBottom: SPACING.md,
                paddingHorizontal: SPACING.lg,
              },
            ]}
          >
            <View style={styles.headerSide}>
              <Pressable
                accessibilityLabel={closeLabel}
                accessibilityRole="button"
                hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                onPress={onClose}
                style={({ pressed }) => [
                  styles.headerButton,
                  { backgroundColor: colors.backgroundLight },
                  pressed && { opacity: 0.7 },
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

          {floatingFooter ? (
            <View
              pointerEvents="box-none"
              style={[
                styles.floatingFooter,
                { paddingBottom: Math.max(insets.bottom, SPACING.md) },
                floatingFooterContainerStyle,
              ]}
              testID="app-page-sheet-floating-footer"
            >
              {floatingFooter}
            </View>
          ) : null}

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
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
    height: '92%',
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  handleContainer: {
    width: '100%',
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 46,
    height: 6,
    borderRadius: 3,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: SPACING.md,
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
    paddingBottom: SPACING.md,
  },
  floatingFooter: {
    bottom: 0,
    left: 0,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    position: 'absolute',
    right: 0,
  },
});
