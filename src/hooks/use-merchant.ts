
import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { getMerchantData, Merchant } from '@/services/merchantService';
import { app } from '@/lib/firebase';

const auth = getAuth(app);

export const useMerchant = () => {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        const merchantData = await getMerchantData(user.uid);
        setMerchant(merchantData);
      } else {
        setUser(null);
        setMerchant(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, merchant, loading };
};
