import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACING } from '@/constants/theme';

interface AppKeyboardContainerProps {
  align?: 'start' | 'center' | 'end';
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
  scrollEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AppKeyboardContainer({
  align = 'end',
  children,
  contentContainerStyle,
  keyboardVerticalOffset = 24,
  scrollEnabled = true,
  style,
}: AppKeyboardContainerProps) {
  const insets = useSafeAreaInsets();
  const justifyContent =
    align === 'start'
      ? 'flex-start'
      : align === 'center'
        ? 'center'
        : 'flex-end';
  const contentStyle: StyleProp<ViewStyle> = [
    styles.content,
    {
      justifyContent,
      paddingBottom: Math.max(insets.bottom, SPACING.lg),
    } satisfies ViewStyle,
    contentContainerStyle,
  ];

  return (
    <KeyboardAvoidingView
      // iOS needs padding to keep the active field above the software keyboard,
      // while Android behaves more reliably when the container resizes by height.
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={[styles.container, style]}
    >
      {scrollEnabled ? (
        <ScrollView
          bounces={false}
          contentContainerStyle={contentStyle}
          keyboardDismissMode={
            // iOS supports interactive dismissal that tracks the user's drag,
            // while Android reliably dismisses on drag in this sheet pattern.
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={contentStyle}>{children}</View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  content: {
    flexGrow: 1,
  },
});
