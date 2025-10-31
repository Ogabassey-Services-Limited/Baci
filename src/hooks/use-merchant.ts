
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getMerchantData, saveMerchantData, type MerchantData } from '@/services/localMerchantService';
import { logger } from '@/lib/logger';

export const useMerchant = () => {
  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadMerchant = useCallback(() => {
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
  
  useEffect(() => {
    reloadMerchant();
  }, [reloadMerchant]);

  const updateMerchant = useCallback((data: Partial<MerchantData>) => {
    const currentData = getMerchantData() || {};
    const newData = { ...currentData, ...data } as MerchantData;
    saveMerchantData(newData);
    setMerchant(newData);
  }, []);

  return { merchant, loading, updateMerchant, reloadMerchant };
};
