import type { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { AppKeyboardContainer } from '@/components/ui/AppKeyboardContainer';
import { SPACING } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface AppDialogModalProps {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  dismissOnBackdropPress?: boolean;
  keyboardAware?: boolean;
  keyboardVerticalOffset?: number;
  onClose: () => void;
  visible: boolean;
}

export function AppDialogModal({
  children,
  contentContainerStyle,
  dismissOnBackdropPress = true,
  keyboardAware = false,
  keyboardVerticalOffset = SPACING['2xl'],
  onClose,
  visible,
}: AppDialogModalProps) {
  const { colors } = useTheme();

  const handleBackdropPress = () => {
    if (dismissOnBackdropPress) {
      onClose();
    }
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityElementsHidden
          accessible={false}
          onPress={handleBackdropPress}
          style={[
            styles.backdrop,
            { backgroundColor: colors.backdrop ?? 'rgba(0, 0, 0, 0.5)' },
          ]}
          testID="app-dialog-backdrop"
        />
        {keyboardAware ? (
          <AppKeyboardContainer
            align="center"
            contentContainerStyle={styles.keyboardContent}
            keyboardVerticalOffset={keyboardVerticalOffset}
            scrollEnabled={false}
            style={styles.keyboardContainer}
          >
            <Pressable
              accessibilityElementsHidden
              accessible={false}
              onPress={handleBackdropPress}
              style={[
                styles.backdrop,
                { backgroundColor: colors.backdrop ?? 'rgba(0, 0, 0, 0.5)' },
              ]}
              testID="app-dialog-keyboard-backdrop"
            />
            <View style={[styles.contentContainer, contentContainerStyle]}>
              {children}
            </View>
          </AppKeyboardContainer>
        ) : (
          <View style={[styles.contentContainer, contentContainerStyle]}>
            {children}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  keyboardContainer: {
    flex: 1,
  },
  keyboardContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
