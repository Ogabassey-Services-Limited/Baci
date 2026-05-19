import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isRuntimePlatform } from '@/config/runtime-platform';
import { SPACING } from '@/constants/theme';

interface AppKeyboardContainerProps {
  align?: 'start' | 'center' | 'end';
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  offsetPreset?: 'default' | 'compactHeader';
  keyboardVerticalOffset?: number;
  scrollEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AppKeyboardContainer({
  align = 'end',
  children,
  contentContainerStyle,
  keyboardVerticalOffset,
  offsetPreset = 'default',
  scrollEnabled = true,
  style,
}: AppKeyboardContainerProps) {
  const insets = useSafeAreaInsets();
  const isIos = isRuntimePlatform('ios');
  const resolvedKeyboardVerticalOffset =
    keyboardVerticalOffset ??
    (offsetPreset === 'compactHeader' && !isIos ? 16 : 24);
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
      behavior={isIos ? 'padding' : 'height'}
      keyboardVerticalOffset={resolvedKeyboardVerticalOffset}
      style={[styles.container, style]}
    >
      {scrollEnabled ? (
        <ScrollView
          bounces={false}
          contentContainerStyle={contentStyle}
          keyboardDismissMode={
            // iOS supports interactive dismissal that tracks the user's drag,
            // while Android reliably dismisses on drag in this sheet pattern.
            isIos ? 'interactive' : 'on-drag'
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
