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

interface KeyboardAwareModalContainerProps {
  align?: 'center' | 'end';
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
  scrollEnabled?: boolean;
}

export function KeyboardAwareModalContainer({
  align = 'end',
  children,
  contentContainerStyle,
  keyboardVerticalOffset = 24,
  scrollEnabled = true,
}: KeyboardAwareModalContainerProps) {
  const insets = useSafeAreaInsets();
  const contentStyle: StyleProp<ViewStyle> = [
    styles.content,
    {
      justifyContent: align === 'center' ? 'center' : 'flex-end',
      paddingBottom: Math.max(insets.bottom, SPACING.lg),
    } satisfies ViewStyle,
    contentContainerStyle,
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={styles.container}
    >
      {scrollEnabled ? (
        <ScrollView
          bounces={false}
          contentContainerStyle={contentStyle}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
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
