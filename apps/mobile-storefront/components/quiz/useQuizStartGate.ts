import { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Gates quiz attempts on the customer having a username set. Quiz results
 * are shown on a public leaderboard, so a display name must exist before an
 * attempt can start.
 */
export function useQuizStartGate(onStart: (eventId: string) => void) {
  const username = useAuthStore((state) => state.customer?.username);
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);

  const requestStart = (eventId: string) => {
    if (!username) {
      setPendingEventId(eventId);
      return;
    }
    onStart(eventId);
  };

  const cancelGate = () => {
    setPendingEventId(null);
  };

  const confirmGate = () => {
    const eventId = pendingEventId;
    setPendingEventId(null);
    if (eventId) onStart(eventId);
  };

  return {
    cancelGate,
    confirmGate,
    isGateVisible: pendingEventId !== null,
    requestStart,
  };
}
