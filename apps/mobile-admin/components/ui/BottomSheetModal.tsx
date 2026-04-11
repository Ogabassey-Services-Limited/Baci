import type { ReactNode } from 'react';
import { AppSheetModal } from '@/components/ui/AppSheetModal';

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
  return (
    <AppSheetModal
      accessibilityLabel={accessibilityLabel}
      onClose={onDismiss}
      presentation="detached"
      scrollEnabled={false}
      visible={visible}
    >
      {children}
    </AppSheetModal>
  );
}
