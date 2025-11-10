
'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/auth-context';
import { getMerchantData as getLocalMerchantData, MerchantData as LocalMerchantData } from '@/services/localMerchantService';

// Supabase data structure
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

// Unified data structure
interface UnifiedMerchantData extends Omit<LocalMerchantData, 'logo'> { // Omit logo to use logo_url
    logo_url?: string;
    user_id?: string; // Optional user_id from Supabase
}

interface MerchantContextType {
  merchant: UnifiedMerchantData | null;
  loading: boolean;
  updateMerchant: (data: Partial<MerchantData>) => Promise<void>;
  reloadMerchant: () => void;
}

const MerchantContext = createContext<MerchantContextType | undefined>(undefined);

interface MerchantProviderProps {
    children: ReactNode;
    slug?: string; // Optional slug for storefronts
}

// Helper to convert local data to the format our UI expects
const adaptLocalData = (localData: LocalMerchantData): UnifiedMerchantData => {
    return {
        business_name: localData.businessName,
        business_type: localData.businessType,
        logo_url: localData.logo,
        brand_colors: localData.colors,
        country: localData.country,
        pages: localData.pages,
    };
};

export const MerchantProvider = ({ children, slug }: MerchantProviderProps) => {
  const { user, loading: authLoading } = useAuth();
  const [merchant, setMerchant] = useState<UnifiedMerchantData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // For the demo, we *always* prioritize local storage.
      const localData = getLocalMerchantData();
      if (localData) {
        console.log("Loaded merchant data from local storage.");
        setMerchant(adaptLocalData(localData));
        setLoading(false);
        return;
      }

      // Fallback to Supabase only if local storage is empty.
      let query = supabase.from('merchants').select('*');

      if (slug) {
        const businessName = decodeURIComponent(slug.replace(/-/g, ' '));
        query = query.ilike('business_name', businessName);
      } else {
        if (authLoading) {
          console.log("Auth is loading, waiting to fetch merchant...");
          return; // Wait for auth to settle
        }

        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user;

        if (!currentUser) {
          console.log("No user session found, clearing merchant data.");
          setMerchant(null);
          setLoading(false);
          return;
        }
        query = query.eq('user_id', currentUser.id);
      }

      console.log("Querying Supabase for merchant data...");
      const { data, error } = await query.single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found, which is not an error here
        throw error;
      }

      if (data) {
        console.log("Merchant data loaded from Supabase.", data);
        setMerchant(data as MerchantData);
      } else {
        console.log("No merchant data found in Supabase.");
        setMerchant(null);
      }
    } catch (error) {
      logger.error({ message: 'Failed to load merchant data', error: error as Error, slug });
      setMerchant(null);
    } finally {
      setLoading(false);
    }
  }, [slug, authLoading, supabase]);

  useEffect(() => {
    loadData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!slug && (event === 'SIGNED_IN' || event === 'SIGNED_OUT')) {
        console.log(`Auth state changed (${event}), reloading merchant data.`);
        loadData();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadData, supabase.auth, slug]);

  const reloadMerchant = useCallback(() => {
    loadData();
  }, [loadData]);

  const updateMerchant = useCallback(async (data: Partial<MerchantData>) => {
    if (!user) {
      logger.error({ message: "Cannot update merchant data, no user logged in."});
      return;
    }

    console.log("Updating merchant data in Supabase...", data);
    const { error } = await supabase
      .from('merchants')
      .update(data)
      .eq('user_id', user.id);

    if (error) {
      logger.error({ message: "Failed to update merchant data", error });
      throw error;
    }

    // Also update local storage to keep it in sync
    const currentLocalData = getLocalMerchantData();
    if (currentLocalData) {
        // This part needs a proper service function, but for a quick fix:
        const updatedLocalData = { ...currentLocalData, ...data };
        localStorage.setItem('merchantData', JSON.stringify(updatedLocalData));
    }
    
    console.log("Merchant data updated, reloading.");
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
