
'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { getMerchantData, saveMerchantData, type MerchantData } from '@/services/localMerchantService';
import { logger } from '@/lib/logger';

interface MerchantContextType {
  merchant: MerchantData | null;
  loading: boolean;
  updateMerchant: (data: Partial<MerchantData>) => void;
  reloadMerchant: () => void;
}

const MerchantContext = createContext<MerchantContextType | undefined>(undefined);

export const MerchantProvider = ({ children }: { children: ReactNode }) => {
  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    setLoading(true);
    try {
      const merchantData = getMerchantData();
      if (merchantData) {
        setMerchant(merchantData);
      }
    } catch (error) {
      logger.error({
        message: 'Failed to load merchant data in MerchantProvider',
        error: error as Error,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const reloadMerchant = useCallback(() => {
    loadData();
  }, [loadData]);

  const updateMerchant = useCallback((data: Partial<MerchantData>) => {
    const currentData = getMerchantData() || {};
    const newData = { ...currentData, ...data } as MerchantData;
    saveMerchantData(newData);
    setMerchant(newData);
  }, []);

  const value = { merchant, loading, updateMerchant, reloadMerchant };

  return (
    <MerchantContext.Provider value={value}>
      {children}
    </MerchantContext.Provider>
  );
};

export const useMerchant = (): MerchantContextType => {
  const context = useContext(MerchantContext);
  if (context === undefined) {
    throw new Error('useMerchant must be used within a MerchantProvider');
  }
  return context;
};
