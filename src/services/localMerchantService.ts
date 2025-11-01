// Simple localStorage-based merchant service (no Firebase needed for demo)
import { logger } from '@/lib/logger';

export interface MerchantData {
  businessName: string;
  businessType: string;
  logo?: string;
  colors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  country?: string;
  pages?: {
    about?: string;
    contact?: string;
    privacy?: string;
    terms?: string;
    faq?: string;
    legal?: string;
  };
}

// Generate a simple user ID for the session
export function generateUserId(): string {
  const existingId = localStorage.getItem('userId');
  if (existingId) return existingId;

  const newId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('userId', newId);
  return newId;
}

export function saveMerchantData(data: MerchantData): void {
  try {
    const userId = generateUserId();
    const existingData = getMerchantData() || {};
    const newData = { ...existingData, ...data } as MerchantData;
    localStorage.setItem(`merchant_${userId}`, JSON.stringify(newData));
    logger.info({ message: 'Merchant data saved to localStorage', userId });
  } catch (error) {
    logger.error({
      message: 'Error saving merchant data to localStorage',
      error: error as Error,
    });
    throw new Error('Could not save merchant data.');
  }
}

export function getMerchantData(): MerchantData | null {
  try {
    const userId = generateUserId();
    const data = localStorage.getItem(`merchant_${userId}`);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    logger.error({
      message: 'Error fetching merchant data from localStorage',
      error: error as Error,
    });
    return null;
  }
}

export function clearMerchantData(): void {
  try {
    const userId = localStorage.getItem('userId');
    if (userId) {
      localStorage.removeItem(`merchant_${userId}`);
    }
    localStorage.removeItem('userId');
  } catch (error) {
    logger.error({
      message: 'Error clearing merchant data',
      error: error as Error,
    });
  }
}
