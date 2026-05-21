import { useEffect, useRef } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SPACING } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import DomainOptionsSheetActions from './DomainOptionsSheetActions';
import DomainOptionsSheetHeader from './DomainOptionsSheetHeader';
import { domainOptionsSheetStyles } from './domain-options-sheet.styles';
import type { Domain, DomainAction } from './domain-types';

interface DomainOptionsSheetProps {
  visible: boolean;
  domain: Domain | null;
  onClose: () => void;
  onAction: (action: DomainAction, domain: Domain) => void;
}

export default function DomainOptionsSheet({
  visible,
  domain,
  onClose,
  onAction,
}: DomainOptionsSheetProps) {
  const { colors, shadows } = useTheme();
  const actionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (actionTimeoutRef.current) {
        clearTimeout(actionTimeoutRef.current);
        actionTimeoutRef.current = null;
      }
    };
  }, []);

  const handleAction = (action: DomainAction) => {
    if (!domain) return;

    onClose();

    if (actionTimeoutRef.current) {
      clearTimeout(actionTimeoutRef.current);
    }

    actionTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        onAction(action, domain);
      }
      actionTimeoutRef.current = null;
    }, 100);
  };

  if (!domain) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={domainOptionsSheetStyles.overlay}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close options"
        accessibilityHint="Closes the domain options menu"
      >
        <Animated.View
          style={[
            domainOptionsSheetStyles.backdrop,
            { backgroundColor: 'rgba(0,0,0,0.4)' },
          ]}
        />
      </Pressable>

      <View style={domainOptionsSheetStyles.sheetContainer} pointerEvents="box-none">
        <Animated.View
          style={[
            domainOptionsSheetStyles.sheet,
            { backgroundColor: colors.card, paddingBottom: SPACING.xl * 2 },
            shadows.lg,
          ]}
        >
          <View style={domainOptionsSheetStyles.handleContainer}>
            <View
              style={[
                domainOptionsSheetStyles.handle,
                { backgroundColor: colors.border },
              ]}
            />
          </View>

          <DomainOptionsSheetHeader domain={domain} />
          <DomainOptionsSheetActions domain={domain} onAction={handleAction} />

          <View style={domainOptionsSheetStyles.footer}>
            <Pressable
              style={[
                domainOptionsSheetStyles.cancelButton,
                { backgroundColor: colors.background },
              ]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              accessibilityHint="Closes the options menu without making changes"
            >
              <Text
                style={[domainOptionsSheetStyles.cancelText, { color: colors.text }]}
              >
                Cancel
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
