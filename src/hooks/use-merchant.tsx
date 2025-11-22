

'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/auth-context';

// Supabase data structure
export interface MerchantData {
  id: string;
  user_id: string;
  business_name: string;
  business_type: string;
  logo_url?: string;
  brand_colors?: {
    primary: string;
    background: string;
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
  slug?: string;
}

interface MerchantContextType {
  merchant: MerchantData | null;
  loading: boolean;
  updateMerchant: (data: Partial<MerchantData>) => Promise<void>;
  reloadMerchant: () => void;
}

const MerchantContext = createContext<MerchantContextType | undefined>(undefined);

interface MerchantProviderProps {
  children: ReactNode;
  slug?: string; // Optional slug for storefronts
}

export const MerchantProvider = ({ children, slug }: MerchantProviderProps) => {
  const { user, loading: authLoading } = useAuth();
  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadData = useCallback(async () => {
    const shouldLoad = slug || !authLoading;
    if (!shouldLoad) {
      setLoading(false);
      return;
    }
    
    setLoading(true);

    try {
      let query = supabase.from('merchants').select('*');

      if (slug) {
        // Revert to using business_name, formatted as a slug
        const businessNameFromSlug = slug.replace(/-/g, ' ');
        query = query.ilike('business_name', businessNameFromSlug);
      } else {
        if (!user) {
          setMerchant(null);
          setLoading(false);
          return;
        }
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setMerchant(data as MerchantData);
      } else {
        setMerchant(null);
      }
    } catch (error) {
      logger.error({ message: `Failed to load merchant data. Slug: ${slug}, Error: ${(error as Error).message}` });
      setMerchant(null);
    } finally {
      setLoading(false);
    }
  }, [slug, authLoading, user, supabase]);


  useEffect(() => {
    loadData();
  }, [loadData]);

  const reloadMerchant = useCallback(() => {
    loadData();
  }, [loadData]);

  const updateMerchant = useCallback(async (data: Partial<MerchantData>) => {
    if (!user) {
      const errorMsg = "Cannot update merchant data, no user logged in.";
      logger.error({ message: errorMsg });
      throw new Error(errorMsg);
    }

    logger.info({ message: 'Updating merchant data in Supabase...', data });
    const { error } = await supabase
      .from('merchants')
      .update(data)
      .eq('user_id', user.id);

    if (error) {
      logger.error({ message: "Failed to update merchant data", error: error as Error });
      throw error;
    }

    logger.info({ message: 'Merchant data updated, reloading.' });
    reloadMerchant();
  }, [user, supabase, reloadMerchant]);

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
  return context as MerchantContextType;
};



