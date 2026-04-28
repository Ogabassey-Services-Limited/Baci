import type { PropsWithChildren } from 'react';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

interface StorefrontScreenShellProps extends PropsWithChildren {
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// `edges` defaults to ['bottom'] only because react-native-screens NativeStack
// already reserves the safe-area-top zone for any screen mounted under our
// root <Stack>. Adding `top` here would double-pad: NativeStack reserves
// insets.top once, then SafeAreaView pads insets.top again — visually a ~120pt
// blank band between the status bar and the screen content. Mirrors the
// admin app's pattern (apps/mobile-admin uses edges=['bottom'] throughout).
//
// Screens that genuinely need top inset (full-bleed modal-style, no
// NativeStack header above them) can pass edges={['top','bottom']} explicitly.
export function StorefrontScreenShell({
  children,
  edges = ['bottom'],
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
