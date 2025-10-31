
'use client';

import { useState, useCallback } from 'react';
import { getMerchantData, saveMerchantData, type MerchantData } from '@/services/localMerchantService';
import { logger } from '@/lib/logger';

// Load initial data synchronously to avoid loading flicker
const initialMerchantData = getMerchantData();

export const useMerchant = () => {
  const [merchant, setMerchant] = useState<MerchantData | null>(initialMerchantData);
  const [loading, setLoading] = useState(!initialMerchantData);

  const reloadMerchant = useCallback(() => {
    setLoading(true);
    try {
      const merchantData = getMerchantData();
      if (merchantData) {
        setMerchant(merchantData);
      }
    } catch (error) {
        logger.error({
            message: 'Failed to load merchant data in useMerchant hook',
            error: error as Error
        });
    } finally {
        setLoading(false);
    }
  }, []);

  const updateMerchant = useCallback((data: Partial<MerchantData>) => {
    const currentData = getMerchantData() || {};
    const newData = { ...currentData, ...data } as MerchantData;
    saveMerchantData(newData);
    setMerchant(newData);
  }, []);

  return { merchant, loading, updateMerchant, reloadMerchant };
};
