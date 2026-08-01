import { useEffect, useRef } from 'react';

export function useBlogMerchantSession(merchantId: string) {
  const sessionRef = useRef({ id: merchantId });
  if (sessionRef.current.id !== merchantId) {
    sessionRef.current = { id: merchantId };
  }

  useEffect(() => {
    const mountedSession = sessionRef.current;
    return () => {
      if (sessionRef.current === mountedSession) {
        sessionRef.current = { id: merchantId };
      }
    };
  }, [merchantId]);

  return sessionRef;
}
