
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { merchantSchema, Merchant } from '@/schemas/merchant';

/**
 * Saves merchant data to Firestore.
 *
 * @param uid - The user's ID from Firebase Auth.
 * @param data - The merchant data to save.
 */
export const saveMerchantData = async (uid: string, data: Merchant) => {
  const validatedData = merchantSchema.parse(data);
  const merchantRef = doc(db, 'merchants', uid);
  await setDoc(merchantRef, validatedData, { merge: true });
};

/**
 * Retrieves merchant data from Firestore.
 *
 * @param uid - The user's ID.
 * @returns The merchant data, or null if not found.
 */
export const getMerchantData = async (uid: string): Promise<Merchant | null> => {
  const merchantRef = doc(db, 'merchants', uid);
  const docSnap = await getDoc(merchantRef);

  if (docSnap.exists()) {
    return merchantSchema.parse(docSnap.data());
  }

  return null;
};
