
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { MerchantData } from '@/services/merchantService';
import { logger } from '@/lib/logger';

let merchantCache: MerchantData | null = null;

export function useMerchant() {
  const [merchant, setMerchant] = useState<MerchantData | null>(merchantCache);
  const [loading, setLoading] = useState(!merchantCache);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (merchantCache) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const merchantRef = doc(db, 'merchants', user.uid);
          const docSnap = await getDoc(merchantRef);

          if (docSnap.exists()) {
            const merchantData = docSnap.data() as MerchantData;
            setMerchant(merchantData);
            merchantCache = merchantData;
          } else {
            throw new Error('No merchant data found for this user.');
          }
        } catch (e) {
          logger.error({ message: 'Failed to fetch merchant data', error: e as Error });
          setError(e as Error);
        } finally {
          setLoading(false);
        }
      } else {
        // Handle user not being logged in
        setMerchant(null);
        setLoading(false);
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  return { merchant, loading, error };
}
