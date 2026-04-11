import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { AppKeyboardContainer } from './AppKeyboardContainer';

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
  return (
    <AppKeyboardContainer
      align={align}
      contentContainerStyle={contentContainerStyle}
      keyboardVerticalOffset={keyboardVerticalOffset}
      scrollEnabled={scrollEnabled}
      style={styles.container}
    >
      {children}
    </AppKeyboardContainer>
  );
}

const styles = {
  container: {
    flex: 1,
    width: '100%',
  },
} satisfies Record<string, ViewStyle>;
