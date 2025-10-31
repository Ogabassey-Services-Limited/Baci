
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { Merchant, merchantSchema } from '@/schemas/merchant';

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

export async function getMerchantData(userId: string): Promise<Merchant | null> {
    try {
        const merchantRef = doc(db, 'merchants', userId);
        const docSnap = await getDoc(merchantRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const parsedData = merchantSchema.safeParse(data);
            if (parsedData.success) {
                return parsedData.data;
            } else {
                logger.error({
                    message: 'Invalid merchant data structure in Firestore',
                    userId,
                    error: parsedData.error,
                });
                return null;
            }
        } else {
            logger.warn({ message: 'No merchant data found for user', userId });
            return null;
        }
    } catch (error) {
        logger.error({
            message: 'Error fetching merchant data from Firestore',
            userId,
            error: error as Error,
        });
        return null;
    }
}
