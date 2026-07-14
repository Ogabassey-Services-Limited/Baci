'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthSafe } from '@/contexts/auth-context';
import { logger } from '@/lib/logger';
import { permissionGrantsAccess } from '@/lib/permission-grant';
import { createClient } from '@/lib/supabase/client';
import { defaultStaffAccess } from './constants';
import { fetchDashboardMerchantViaApi } from './fetch-dashboard-merchant-via-api';
import { MerchantContext } from './merchant-context';
import {
  assertNoIdentityFields,
  pickGenericWritable,
} from './merchant-writable-fields';
import { getDemoMerchant } from './mock-data';
import { fetchMerchantBySlug, fetchPrimaryDomain } from './queries';
import type {
  MerchantContextType,
  MerchantData,
  MerchantProviderProps,
  StaffAccess,
} from './types';

type SupabaseClient = ReturnType<typeof createClient>;

interface LoadBySlugArgs {
  supabase: SupabaseClient;
  slug: string;
  isCancelled: () => boolean;
  setMerchant: (merchant: MerchantData | null) => void;
  setLoading: (loading: boolean) => void;
}

// Module-scope helper owns the try/catch/finally so the provider body stays
// lowerable by the React Compiler (try/finally bails out the whole component).
async function loadMerchantBySlug({
  supabase,
  slug,
  isCancelled,
  setMerchant,
  setLoading,
}: LoadBySlugArgs): Promise<void> {
  try {
    const data = await fetchMerchantBySlug(supabase, slug);
    if (isCancelled()) return;

    if (data?.id) {
      const domain = await fetchPrimaryDomain(supabase, data.id);
      if (!isCancelled() && domain) data.custom_domain = domain;
    }

    if (!isCancelled()) setMerchant(data);
  } catch (error) {
    logger.error({
      message: `Failed to load merchant by slug: ${slug}. Error: ${(error as Error).message}`,
    });
    if (!isCancelled()) setMerchant(null);
  } finally {
    if (!isCancelled()) setLoading(false);
  }
}

interface LoadDashboardArgs {
  isCancelled: () => boolean;
  setMerchant: (merchant: MerchantData | null) => void;
  setStaffAccess: (access: StaffAccess) => void;
  setLoading: (loading: boolean) => void;
}

async function loadDashboardMerchant({
  isCancelled,
  setMerchant,
  setStaffAccess,
  setLoading,
}: LoadDashboardArgs): Promise<void> {
  try {
    // Reads the own-merchant context (incl. sensitive columns + primary domain)
    // through the /api/merchant/me server boundary rather than the browser's
    // authenticated Supabase client — see fetch-dashboard-merchant-via-api.ts.
    const result = await fetchDashboardMerchantViaApi();
    if (isCancelled()) return;

    setMerchant(result.merchant);
    setStaffAccess(result.staffAccess);
  } catch (error) {
    logger.error({
      message: `Failed to load merchant data. Error: ${(error as Error).message}`,
    });
    if (!isCancelled()) {
      setMerchant(null);
      setStaffAccess(defaultStaffAccess);
    }
  } finally {
    if (!isCancelled()) setLoading(false);
  }
}

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

  // Resolve a demo merchant synchronously from the slug (no DB call). Used for
  // both the initial state and prop-change sync so the data is ready on the
  // first commit instead of routing a synchronous setState through an effect.
  const initialDemoMerchant =
    !initialMerchant && slug ? getDemoMerchant(slug) : null;

  const [merchant, setMerchant] = useState<MerchantData | null>(
    initialMerchant ?? initialDemoMerchant ?? null
  );
  const [loading, setLoading] = useState(
    !initialMerchant && !initialDemoMerchant
  );
  const [staffAccess, setStaffAccess] = useState<StaffAccess>(
    initialStaffAccess ?? defaultStaffAccess
  );

  // When the slug prop changes, re-resolve any demo merchant during render
  // (via a prev-prop comparison) instead of an effect. Real slugs/users are
  // loaded async in the effect below.
  const [prevSlug, setPrevSlug] = useState(slug);
  if (slug !== prevSlug) {
    setPrevSlug(slug);
    if (!initialMerchant && slug) {
      const demoMerchant = getDemoMerchant(slug);
      if (demoMerchant) {
        setMerchant(demoMerchant);
        setLoading(false);
      }
    }
  }

  // Flip `loading` on during render (a prev-key comparison) whenever the inputs
  // that trigger a fresh async load change, instead of calling setLoading(true)
  // synchronously inside the effect — that forces an extra render where stale
  // (not-loading) state is briefly visible. The effect below only resolves the
  // data and turns loading back off via the module-scope loaders.
  const willFetchBySlug =
    !initialMerchant && Boolean(slug) && !getDemoMerchant(slug ?? '');
  const willFetchDashboard =
    !initialMerchant && !slug && !authLoading && Boolean(user);
  // Dashboard mode with auth resolved but no signed-in user → signed-out reset.
  const isAnonDashboard = !initialMerchant && !slug && !authLoading && !user;
  const fetchLoadingKey = initialMerchant
    ? 'static'
    : willFetchBySlug
      ? `slug:${slug}`
      : willFetchDashboard
        ? `user:${user?.id ?? ''}`
        : isAnonDashboard
          ? 'anon'
          : 'idle';
  // Seed an "init" sentinel so the first render always reconciles loading with
  // the resolved fetch state (e.g. an immediate signed-out reset on mount).
  const [prevFetchLoadingKey, setPrevFetchLoadingKey] = useState('init');
  if (fetchLoadingKey !== prevFetchLoadingKey) {
    setPrevFetchLoadingKey(fetchLoadingKey);
    if (willFetchBySlug || willFetchDashboard) {
      setLoading(true);
    } else if (isAnonDashboard) {
      // Mirror the signed-out reset during render instead of in the effect so
      // no stale merchant is briefly shown after logout.
      setMerchant(null);
      setStaffAccess(defaultStaffAccess);
      setLoading(false);
    }
  }

  const routingMode = initialRoutingMode ?? 'path';
  const basePath =
    routingMode === 'domain' ? '' : `/${merchant?.slug || slug || ''}`;

  // Stable Supabase client — created once, not on every render
  const supabaseRef = useRef(createClient());

  // ---- DATA LOADING ----
  // CASE 1: initialMerchant provided → no fetch (dashboard + storefront with SSR data)
  // CASE 2: slug provided, no initialMerchant → demo check or fetchMerchantBySlug
  // CASE 3: no slug, no initialMerchant → wait for auth, then load the dashboard
  // merchant via the /api/merchant/me server boundary

  useEffect(() => {
    // CASE 1: Server-provided data — trust it, skip fetch
    if (initialMerchant) return;

    // CASE 2: Storefront mode (slug, no initial data)
    if (slug) {
      // Demo merchants are resolved synchronously during render (see below).
      if (getDemoMerchant(slug)) return;

      // `loading` is flipped on during render (see fetchLoadingKey above).
      let cancelled = false;

      void loadMerchantBySlug({
        supabase: supabaseRef.current,
        slug,
        isCancelled: () => cancelled,
        setMerchant,
        setLoading,
      });

      return () => {
        cancelled = true;
      };
    }

    // CASE 3: Dashboard/Builder mode (no slug, no initial data)
    if (authLoading) return;
    // Signed-out reset is handled during render (see fetchLoadingKey above).
    if (!user) return;

    // `loading` is flipped on during render (see fetchLoadingKey above).
    let cancelled = false;

    void loadDashboardMerchant({
      isCancelled: () => cancelled,
      setMerchant,
      setStaffAccess,
      setLoading,
    });

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
      fetchDashboardMerchantViaApi()
        .then((result) => {
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

    if (
      staffAccess.isStaff &&
      !permissionGrantsAccess(staffAccess.permissions, 'settings', 'edit')
    ) {
      const errorMsg = "You don't have permission to update store settings.";
      logger.error({ message: errorMsg });
      throw new Error(errorMsg);
    }

    // PR-D / V1: fail-closed deny-list — identity/contact/legal fields must NOT
    // be written through this generic sink (they drifted to placeholders when an
    // unfiltered payload from any caller landed a stale identity key in the DB).
    // They go through the dedicated /api/merchant/settings PATCH route instead.
    assertNoIdentityFields(data);

    // Allowlist: drop everything not explicitly generic-writable so no unknown
    // key can ever reach the DB through this path.
    const writableData = pickGenericWritable(data);
    if (Object.keys(writableData).length === 0) {
      logger.info({
        message: 'Merchant update skipped: no generic-writable fields present.',
      });
      return;
    }

    logger.info({
      message: 'Updating merchant data in Supabase...',
      data: writableData,
    });

    const query = staffAccess.isOwner
      ? supabaseRef.current
          .from('merchants')
          .update(writableData)
          .eq('user_id', user.id)
      : supabaseRef.current
          .from('merchants')
          .update(writableData)
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
      setMerchant((prev) => (prev ? { ...prev, ...writableData } : prev));
      logger.info({ message: 'Merchant data updated optimistically.' });
    } else {
      logger.info({ message: 'Merchant data updated, reloading.' });
      reloadMerchant();
    }
  };

  const hasPermission = (resource: string, action: string): boolean => {
    if (staffAccess.isOwner) return true;
    if (!staffAccess.isStaff) return false;
    return permissionGrantsAccess(staffAccess.permissions, resource, action);
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
