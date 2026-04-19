'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthSafe } from '@/contexts/auth-context';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/client';
import { defaultStaffAccess } from './constants';
import { MerchantContext } from './merchant-context';
import { getDemoMerchant } from './mock-data';
import {
  fetchDashboardMerchant,
  fetchMerchantBySlug,
  fetchPrimaryDomain,
} from './queries';
import type {
  MerchantContextType,
  MerchantData,
  MerchantProviderProps,
  StaffAccess,
} from './types';

export const MerchantProvider = ({
  children,
  slug,
  initialMerchant,
  initialStaffAccess,
  initialRoutingMode,
  navigationCategories = [],
}: MerchantProviderProps) => {
  const auth = useAuthSafe();
  const user = auth?.user ?? null;
  const authLoading = auth?.loading ?? false;

  const [merchant, setMerchant] = useState<MerchantData | null>(
    initialMerchant ?? null
  );
  const [loading, setLoading] = useState(!initialMerchant);
  const [staffAccess, setStaffAccess] = useState<StaffAccess>(
    initialStaffAccess ?? defaultStaffAccess
  );

  const routingMode = initialRoutingMode ?? 'path';
  const basePath =
    routingMode === 'domain' ? '' : `/${merchant?.slug || slug || ''}`;

  // Stable Supabase client — created once, not on every render
  const supabaseRef = useRef(createClient());

  // ---- DATA LOADING ----
  // CASE 1: initialMerchant provided → no fetch (dashboard + storefront with SSR data)
  // CASE 2: slug provided, no initialMerchant → demo check or fetchMerchantBySlug
  // CASE 3: no slug, no initialMerchant → wait for auth, then fetchDashboardMerchant

  useEffect(() => {
    // CASE 1: Server-provided data — trust it, skip fetch
    if (initialMerchant) return;

    // CASE 2: Storefront mode (slug, no initial data)
    if (slug) {
      const demoMerchant = getDemoMerchant(slug);
      if (demoMerchant) {
        setMerchant(demoMerchant);
        setLoading(false);
        return;
      }

      let cancelled = false;
      setLoading(true);

      (async () => {
        try {
          const data = await fetchMerchantBySlug(supabaseRef.current, slug);
          if (cancelled) return;

          if (data?.id) {
            const domain = await fetchPrimaryDomain(
              supabaseRef.current,
              data.id
            );
            if (!cancelled && domain) data.custom_domain = domain;
          }

          if (!cancelled) setMerchant(data);
        } catch (error) {
          logger.error({
            message: `Failed to load merchant by slug: ${slug}. Error: ${(error as Error).message}`,
          });
          if (!cancelled) setMerchant(null);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    // CASE 3: Dashboard/Builder mode (no slug, no initial data)
    if (authLoading) return;
    if (!user) {
      setMerchant(null);
      setStaffAccess(defaultStaffAccess);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const result = await fetchDashboardMerchant(
          supabaseRef.current,
          user.id
        );
        if (cancelled) return;

        if (result.merchant?.id) {
          const domain = await fetchPrimaryDomain(
            supabaseRef.current,
            result.merchant.id
          );
          if (!cancelled && domain) result.merchant.custom_domain = domain;
        }

        if (!cancelled) {
          setMerchant(result.merchant);
          setStaffAccess(result.staffAccess);
        }
      } catch (error) {
        logger.error({
          message: `Failed to load merchant data. Error: ${(error as Error).message}`,
        });
        if (!cancelled) {
          setMerchant(null);
          setStaffAccess(defaultStaffAccess);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, authLoading, user?.id, initialMerchant, user]);

  // ---- ACTIONS ----

  const reloadMerchant = () => {
    setLoading(true);

    if (slug) {
      fetchMerchantBySlug(supabaseRef.current, slug)
        .then(async (data) => {
          if (data?.id) {
            const domain = await fetchPrimaryDomain(
              supabaseRef.current,
              data.id
            );
            if (domain) data.custom_domain = domain;
          }
          setMerchant(data);
        })
        .catch((error) => {
          logger.error({
            message: `Reload failed: ${(error as Error).message}`,
          });
        })
        .finally(() => setLoading(false));
    } else if (user) {
      fetchDashboardMerchant(supabaseRef.current, user.id)
        .then(async (result) => {
          if (result.merchant?.id) {
            const domain = await fetchPrimaryDomain(
              supabaseRef.current,
              result.merchant.id
            );
            if (domain) result.merchant.custom_domain = domain;
          }
          setMerchant(result.merchant);
          setStaffAccess(result.staffAccess);
        })
        .catch((error) => {
          logger.error({
            message: `Reload failed: ${(error as Error).message}`,
          });
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  };

  const updateMerchant = async (
    data: Partial<MerchantData>,
    options?: { skipReload?: boolean }
  ) => {
    if (!user) {
      const errorMsg = 'Cannot update merchant data, no user logged in.';
      logger.error({ message: errorMsg });
      throw new Error(errorMsg);
    }

    if (staffAccess.isStaff && !staffAccess.permissions.settings?.edit) {
      const errorMsg = "You don't have permission to update store settings.";
      logger.error({ message: errorMsg });
      throw new Error(errorMsg);
    }

    logger.info({ message: 'Updating merchant data in Supabase...', data });

    const query = staffAccess.isOwner
      ? supabaseRef.current
          .from('merchants')
          .update(data)
          .eq('user_id', user.id)
      : supabaseRef.current
          .from('merchants')
          .update(data)
          .eq('id', merchant?.id);

    const { error } = await query;

    if (error) {
      logger.error({
        message: 'Failed to update merchant data',
        error: error as Error,
      });
      throw error;
    }

    if (options?.skipReload) {
      setMerchant((prev) => (prev ? { ...prev, ...data } : prev));
      logger.info({ message: 'Merchant data updated optimistically.' });
    } else {
      logger.info({ message: 'Merchant data updated, reloading.' });
      reloadMerchant();
    }
  };

  const hasPermission = (resource: string, action: string): boolean => {
    if (staffAccess.isOwner) return true;
    if (staffAccess.isStaff) {
      return staffAccess.permissions[resource]?.[action] === true;
    }
    return false;
  };

  const value: MerchantContextType = {
    merchant,
    loading,
    updateMerchant,
    reloadMerchant,
    staffAccess,
    hasPermission,
    routingMode,
    basePath,
    navigationCategories,
  };

  return (
    <MerchantContext.Provider value={value}>
      {children}
    </MerchantContext.Provider>
  );
};
