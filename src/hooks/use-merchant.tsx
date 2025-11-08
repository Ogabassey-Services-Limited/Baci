
'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/auth-context';

export interface MerchantData {
  user_id: string;
  business_name: string;
  business_type: string;
  logo_url?: string;
  brand_colors?: {
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

interface MerchantContextType {
  merchant: MerchantData | null;
  loading: boolean;
  updateMerchant: (data: Partial<MerchantData>) => Promise<void>;
  reloadMerchant: () => void;
}

const MerchantContext = createContext<MerchantContextType | undefined>(undefined);

export const MerchantProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadData = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      
      const currentUser = sessionData.session?.user;

      if (!currentUser) {
        setMerchant(null);
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116: 'exact-one' returns 0 rows
        throw error;
      }
      
      if (data) {
        const merchantData: MerchantData = {
          user_id: data.user_id,
          business_name: data.business_name,
          business_type: data.business_type,
          logo_url: data.logo_url,
          brand_colors: data.brand_colors,
          country: data.country,
          pages: data.pages,
        };
        setMerchant(merchantData);
      } else {
        setMerchant(null);
      }
    } catch (error) {
      logger.error({
        message: 'Failed to load merchant data from Supabase',
        error: error as Error,
      });
      setMerchant(null);
    } finally {
      setLoading(false);
    }
  }, [authLoading, supabase]);

  useEffect(() => {
    loadData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        // Reload merchant data on sign in/out
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
            loadData();
        }
    });

    return () => {
        subscription.unsubscribe();
    };
  }, [loadData, supabase.auth]);

  const reloadMerchant = useCallback(() => {
    loadData();
  }, [loadData]);

  const updateMerchant = useCallback(async (data: Partial<MerchantData>) => {
    if (!user) {
      logger.error({ message: "Cannot update merchant data, no user logged in."});
      return;
    }

    const { error } = await supabase
      .from('merchants')
      .update(data)
      .eq('user_id', user.id);

    if (error) {
      logger.error({ message: "Failed to update merchant data", error });
      throw error;
    }

    // Reload data from DB to ensure consistency
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
  return context;
};
