import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';

export interface MerchantData {
  businessName: string;
  businessType: string;
  logo?: string;
  colors?: {
    primary: string;
    secondary: string;
  };
}

export async function saveMerchantData(userId: string, data: MerchantData): Promise<void> {
  try {
    const merchantRef = doc(db, 'merchants', userId);
    await setDoc(merchantRef, data, { merge: true });
    logger.info({ message: 'Merchant data saved successfully', userId });
  } catch (error) {
    logger.error({
      message: 'Error saving merchant data to Firestore',
      userId,
      error: error as Error,
    });
    throw new Error('Could not save merchant data.');
  }
}