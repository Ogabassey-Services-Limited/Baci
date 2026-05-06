import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import {
  KeyboardAvoidingView,
  type KeyboardAvoidingViewProps,
} from 'react-native-keyboard-controller';

type AppKeyboardContainerProps = KeyboardAvoidingViewProps & {
  children?: ReactNode;
};

export default function AppKeyboardContainer({
  automaticOffset = true,
  behavior = 'padding',
  children,
  style,
  ...props
}: AppKeyboardContainerProps) {
  return (
    <KeyboardAvoidingView
      automaticOffset={automaticOffset}
      behavior={behavior}
      style={[styles.container, style]}
      {...props}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
