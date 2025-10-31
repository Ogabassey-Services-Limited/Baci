
'use client';

import { useState, useEffect } from 'react';
import { getMerchantData, type MerchantData } from '@/services/localMerchantService';
import { logger } from '@/lib/logger';

export const useMerchant = () => {
  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  return { merchant, loading };
};
