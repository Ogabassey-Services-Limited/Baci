import type { Dispatch, SetStateAction } from 'react';
import type { StatusModalState } from '@/components/ui/StatusModal';
import { SubscriptionManagement } from '@/utils/SubscriptionManagement';

interface UseSubscriptionManagementOptions {
  setStatusModal: Dispatch<SetStateAction<StatusModalState>>;
}

export function useSubscriptionManagement({
  setStatusModal,
}: UseSubscriptionManagementOptions) {
  const showSubscriptionManagementError = () => {
    setStatusModal({
      visible: true,
      type: 'error',
      title: 'Unable to Open',
      message: 'Could not open subscription management. Please try again.',
    });
  };

  const handleManageSubscription = async () => {
    try {
      const opened = await SubscriptionManagement.openNativeManagement();

      if (!opened) {
        return;
      }
    } catch (error) {
      console.error('Failed to open subscription management:', error);
      showSubscriptionManagementError();
    }
  };

  return {
    handleManageSubscription,
  };
}
