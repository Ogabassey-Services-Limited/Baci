import { useRef, useState } from 'react';

export function calculateQuizServerClockOffset(
  serverNow: string,
  observedAtMs = Date.now()
): number {
  const parsed = Date.parse(serverNow);
  return Number.isFinite(parsed) ? parsed - observedAtMs : 0;
}

export function useQuizServerClock(
  serverNow: string | null,
  observedAtMs?: number
): { offsetMs: number; serverNowMs: number } {
  const initialObservedAtRef = useRef(observedAtMs ?? Date.now());
  const effectiveObservedAt = observedAtMs ?? initialObservedAtRef.current;
  const key = `${serverNow ?? 'none'}:${effectiveObservedAt}`;
  const [snapshot, setSnapshot] = useState(() => ({
    key,
    offsetMs: serverNow
      ? calculateQuizServerClockOffset(serverNow, effectiveObservedAt)
      : 0,
  }));
  if (snapshot.key !== key) {
    setSnapshot({
      key,
      offsetMs: serverNow
        ? calculateQuizServerClockOffset(serverNow, effectiveObservedAt)
        : 0,
    });
  }
  return {
    offsetMs: snapshot.offsetMs,
    serverNowMs: Date.now() + snapshot.offsetMs,
  };
}
