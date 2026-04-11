import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RADIUS, SPACING } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface BottomSheetModalProps {
  accessibilityLabel: string;
  children: ReactNode;
  onDismiss: () => void;
  visible: boolean;
}

export function BottomSheetModal({
  accessibilityLabel,
  children,
  onDismiss,
  visible,
}: BottomSheetModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          padding: SPACING.lg,
        }}
      >
        <Pressable
          accessibilityElementsHidden
          accessible={false}
          onPress={onDismiss}
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: 'rgba(0,0,0,0.35)' },
          ]}
        />
        <View
          accessibilityLabel={accessibilityLabel}
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.background,
            borderColor: colors.border,
            borderRadius: RADIUS['2xl'],
            borderWidth: 1,
            padding: SPACING.lg,
            paddingBottom: Math.max(insets.bottom, SPACING.lg),
          }}
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}
