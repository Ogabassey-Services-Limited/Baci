import type { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SPACING } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface AppDialogModalProps {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  dismissOnBackdropPress?: boolean;
  onClose: () => void;
  visible: boolean;
}

export function AppDialogModal({
  children,
  contentContainerStyle,
  dismissOnBackdropPress = true,
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
        <View style={[styles.contentContainer, contentContainerStyle]}>
          {children}
        </View>
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
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
