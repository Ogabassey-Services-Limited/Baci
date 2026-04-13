import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';
import { AppKeyboardContainer } from '@/components/ui/AppKeyboardContainer';

interface AppFormScreenProps {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  footer?: ReactNode;
  footerStyle?: StyleProp<ViewStyle>;
  header?: ReactNode;
  keyboardVerticalOffset?: number;
  scrollEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AppFormScreen({
  children,
  contentContainerStyle,
  edges,
  footer,
  footerStyle,
  header,
  keyboardVerticalOffset = 24,
  scrollEnabled = true,
  style,
}: AppFormScreenProps) {
  return (
    <SafeAreaView edges={edges} style={[styles.container, style]}>
      {header ? <View style={styles.header}>{header}</View> : null}
      <AppKeyboardContainer
        align="start"
        contentContainerStyle={contentContainerStyle}
        keyboardVerticalOffset={keyboardVerticalOffset}
        scrollEnabled={scrollEnabled}
        style={styles.keyboardContainer}
      >
        {children}
      </AppKeyboardContainer>
      {footer ? (
        <View style={[styles.footer, footerStyle]}>{footer}</View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    width: '100%',
  },
  keyboardContainer: {
    flex: 1,
  },
  footer: {
    width: '100%',
  },
});
