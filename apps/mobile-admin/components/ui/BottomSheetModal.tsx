import type { ReactNode } from 'react';
import { AppSheetModal } from '@/components/ui/AppSheetModal';

interface BottomSheetModalProps {
  accessibilityLabel: string;
  children: ReactNode;
  onDismiss: () => void;
  scrollEnabled?: boolean;
  visible: boolean;
}

export function BottomSheetModal({
  accessibilityLabel,
  children,
  onDismiss,
  scrollEnabled = true,
  visible,
}: BottomSheetModalProps) {
  return (
    <AppSheetModal
      accessibilityLabel={accessibilityLabel}
      onClose={onDismiss}
      presentation="detached"
      scrollEnabled={scrollEnabled}
      visible={visible}
    >
      {children}
    </AppSheetModal>
  );
}
