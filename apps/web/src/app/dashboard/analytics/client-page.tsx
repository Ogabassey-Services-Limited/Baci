'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  type AnalyticsCategory,
  AnalyticsCategoryNav,
  VALID_CATEGORIES,
} from '@/components/analytics/analytics-category-nav';
import { isAnalyticsCategoryAllowed } from '@/components/analytics/analytics-category-permissions';
import { AnalyticsFilters } from '@/components/analytics/analytics-filters';
import {
  type AnalyticsData,
  DraggableAnalyticsGrid,
} from '@/components/analytics/draggable-analytics-grid';
import { BagLoader } from '@/components/ui/bag-loader';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';
import { buildAdsSyncWindow } from '@/lib/analytics/default-ads-sync-window';
import { fetchAnalyticsCategoryData } from './fetch-analytics-category-data';
import { fetchBaseAnalytics } from './fetch-base-analytics';

// Module-scope wrapper keeps the dynamic import() expression out of the
// component body (React Compiler cannot lower import expressions yet).
function loadAnalyticsExport() {
  return import('@/lib/analytics-export');
}

export default function AnalyticsClientPage() {
  const { toast } = useToast();
  const { hasPermission, merchant, loading: merchantLoading } = useMerchant();
  const [date, setDate] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)),
    to: new Date(),
  });
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');
  const cacheBustParam = searchParams.get('cacheBust');
  const merchantIdParam = searchParams.get('merchantId');
  const callbackReason = searchParams.get('reason');
  const callbackProvider = [
    ['google_ads', 'Google Ads'],
    ['meta_ads', 'Meta Ads'],
    ['tiktok_ads', 'TikTok Ads'],
    ['snapchat_ads', 'Snapchat Ads'],
  ].find(([parameter]) => searchParams.get(parameter ?? '') === 'error');
  const initialAnalyticsRefreshKey =
    cacheBustParam && /^\d{1,10}$/.test(cacheBustParam)
      ? Number(cacheBustParam)
      : 0;
  const requestedCategory =
    categoryParam &&
    VALID_CATEGORIES.includes(categoryParam as AnalyticsCategory)
      ? (categoryParam as AnalyticsCategory)
      : 'overview';
  const [activeCategory, setActiveCategory] = useState<AnalyticsCategory>(() =>
    isAnalyticsCategoryAllowed(requestedCategory, hasPermission)
      ? requestedCategory
      : 'overview'
  );
  // Split state to avoid race conditions where base fetch overwrites category data
  const [baseAnalytics, setBaseAnalytics] = useState<AnalyticsData | null>(
    null
  );
  const [categoryAnalytics, setCategoryAnalytics] = useState<
    Partial<AnalyticsData>
  >({});
  const [categoryAnalyticsError, setCategoryAnalyticsError] = useState<
    string | null
  >(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [loadingCategoryAnalytics, setLoadingCategoryAnalytics] =
    useState(false);
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(
    initialAnalyticsRefreshKey
  );
  const selectedMerchantId =
    merchantIdParam &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      merchantIdParam
    )
      ? merchantIdParam
      : merchant?.id;

  useEffect(() => {
    if (!callbackProvider) return;
    toast({
      description: callbackReason
        ? `Reason: ${callbackReason.replaceAll('_', ' ')}`
        : 'Please try connecting again.',
      title: `${callbackProvider[1]} connection failed`,
      variant: 'destructive',
    });
  }, [callbackProvider?.[0], callbackReason, toast]);

  // Derived state
  const analyticsData: AnalyticsData | null = baseAnalytics
    ? { ...baseAnalytics, ...categoryAnalytics }
    : null;

  useEffect(() => {
    if (!selectedMerchantId || !date.from || !date.to) return;

    const controller = new AbortController();

    fetchBaseAnalytics({
      from: date.from,
      merchantId: selectedMerchantId,
      to: date.to,
      signal: controller.signal,
      setBaseAnalytics,
      setLoadingAnalytics,
    });

    return () => controller.abort();
  }, [date.from, date.to, selectedMerchantId]);

  // Fetch specialized data when category changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: using merchant?.id instead of merchant object avoids infinite loop without React Compiler
  useEffect(() => {
    const controller = new AbortController();
    setCategoryAnalytics({});
    setCategoryAnalyticsError(null);
    const isSpecialized = ['ads', 'inventory', 'segments'].includes(
      activeCategory
    );
    setLoadingCategoryAnalytics(isSpecialized);

    if (
      !selectedMerchantId ||
      !date.from ||
      !date.to ||
      !isAnalyticsCategoryAllowed(activeCategory, hasPermission)
    ) {
      setLoadingCategoryAnalytics(false);
      return () => controller.abort();
    }

    fetchAnalyticsCategoryData({
      category: activeCategory,
      from: date.from,
      merchantId: selectedMerchantId,
      refreshKey: analyticsRefreshKey > 0 ? analyticsRefreshKey : undefined,
      signal: controller.signal,
      to: date.to,
    })
      .then((categoryData) => {
        if (!controller.signal.aborted) {
          setCategoryAnalytics(categoryData);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Error fetching category analytics:', error);
        if (!controller.signal.aborted) {
          setCategoryAnalytics({});
          setCategoryAnalyticsError(
            `Unable to load ${activeCategory} analytics. Please try again.`
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingCategoryAnalytics(false);
        }
      });

    return () => controller.abort();
  }, [
    activeCategory,
    analyticsRefreshKey,
    date.from,
    date.to,
    selectedMerchantId,
  ]);

  const visibleCategories = VALID_CATEGORIES.filter((category) =>
    isAnalyticsCategoryAllowed(category, hasPermission)
  );

  if (!visibleCategories.includes(activeCategory)) {
    setActiveCategory('overview');
  }

  const handleAdsReportingSynced = () => {
    setAnalyticsRefreshKey((currentKey) => currentKey + 1);
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!analyticsData) {
      toast({
        title: 'No data to export',
        description: 'Please wait for analytics data to load.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (format === 'csv') {
        const { exportAnalyticsAsCSV } = await loadAnalyticsExport();
        exportAnalyticsAsCSV(analyticsData, date, merchant?.business_name);
        toast({
          title: 'CSV Exported',
          description: 'Your analytics report has been downloaded as CSV.',
        });
      } else {
        const { exportAnalyticsAsPDF } = await loadAnalyticsExport();
        exportAnalyticsAsPDF(analyticsData, date, merchant?.business_name);
        toast({
          title: 'PDF Exported',
          description: 'Your analytics report has been downloaded as PDF.',
        });
      }
    } catch (error) {
      toast({
        title: 'Export Failed',
        description:
          'There was an error exporting your report. Please try again.',
        variant: 'destructive',
      });
      console.error('Export error:', error);
    }
  };

  if (merchantLoading) {
    return (
      <div className="flex flex-1 items-center justify-center h-full">
        <BagLoader size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 relative overflow-hidden max-w-full min-w-0">
      {/* Dynamic Background Elements from Login Page */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-primary/10 via-background to-background -z-10 pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] bg-center mask-[linear-gradient(180deg,white,rgba(255,255,255,0))] -z-10 pointer-events-none opacity-50" />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent">
            Analytics 📈
          </h1>
          <p className="text-muted-foreground">
            Deep dive into your store's performance.
          </p>
        </div>

        {/* AI Assistant Panel - Moved to Grid Controls */}
      </div>

      {/* Analytics Controls */}
      <div className="flex flex-col gap-4 sticky top-0 z-10 py-4 bg-background/60 backdrop-blur-xl -mx-6 px-6 border-b border-white/10">
        <AnalyticsCategoryNav
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          visibleCategories={visibleCategories}
        />
        <AnalyticsFilters
          date={date}
          onDateChange={setDate}
          onExport={handleExport}
        />
      </div>

      {/* Main Analytics Grid */}
      <DraggableAnalyticsGrid
        data={analyticsData || {}}
        loading={loadingAnalytics || loadingCategoryAnalytics}
        activeCategory={activeCategory}
        merchant={
          merchant && selectedMerchantId
            ? { ...merchant, id: selectedMerchantId }
            : merchant
        }
        categoryError={categoryAnalyticsError}
        onAdsReportingSynced={handleAdsReportingSynced}
        syncWindow={
          date.from && date.to
            ? buildAdsSyncWindow(date.from, date.to)
            : undefined
        }
      />
    </div>
  );
}
