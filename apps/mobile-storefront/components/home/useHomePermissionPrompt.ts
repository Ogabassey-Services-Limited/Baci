import { useEffect, useState } from 'react';
import { usePermissionBooster } from '@/hooks/use-permission-booster';

const HOME_TRACKING_SOFT_ASK_DELAY_MS = 3000;

export function useHomePermissionPrompt() {
  const { requestPermission, triggerSystemPrompt, markDenied } =
    usePermissionBooster();
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  useEffect(() => {
    // Check for tracking permissions (Soft Ask) - ATT.
    // Ask during personalized deal discovery after products are visible.
    const timerId = setTimeout(async () => {
      const result = await requestPermission('tracking');
      if (result === 'soft-ask-needed') {
        setShowPermissionModal(true);
      }
    }, HOME_TRACKING_SOFT_ASK_DELAY_MS);

    return () => {
      clearTimeout(timerId);
    };
  }, [requestPermission]);

  const handlePermissionGrant = async () => {
    setShowPermissionModal(false);
    await triggerSystemPrompt('tracking');
  };

  const handlePermissionDeny = () => {
    setShowPermissionModal(false);
    markDenied('tracking');
  };

  return {
    handlePermissionDeny,
    handlePermissionGrant,
    showPermissionModal,
  };
}
