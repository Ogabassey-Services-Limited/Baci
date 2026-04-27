import type { PropsWithChildren } from 'react';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

export interface StorefrontScreenShellProps extends PropsWithChildren {
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function StorefrontScreenShell({
  children,
  edges = ['top', 'bottom'],
  style,
  testID,
}: StorefrontScreenShellProps) {
  return (
    <SafeAreaView
      testID={testID}
      edges={edges}
      style={[styles.container, style]}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
