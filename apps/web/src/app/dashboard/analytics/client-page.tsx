'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  type AnalyticsCategory,
  AnalyticsCategoryNav,
  VALID_CATEGORIES,
} from '@/components/analytics/analytics-category-nav';
import { AnalyticsFilters } from '@/components/analytics/analytics-filters';
import {
  type AnalyticsData,
  DraggableAnalyticsGrid,
} from '@/components/analytics/draggable-analytics-grid';
import { BagLoader } from '@/components/ui/bag-loader';
import { useMerchant } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import {
  exportAnalyticsAsCSV,
  exportAnalyticsAsPDF,
} from '@/lib/analytics-export';

export default function AnalyticsClientPage() {
  const { toast } = useToast();
  const { merchant, loading: merchantLoading } = useMerchant();
  const [date, setDate] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)),
    to: new Date(),
  });
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');
  const [activeCategory, setActiveCategory] = useState<AnalyticsCategory>(
    categoryParam &&
      VALID_CATEGORIES.includes(categoryParam as AnalyticsCategory)
      ? (categoryParam as AnalyticsCategory)
      : 'overview'
  );
  // Split state to avoid race conditions where base fetch overwrites category data
  const [baseAnalytics, setBaseAnalytics] = useState<AnalyticsData | null>(
    null
  );
  const [categoryAnalytics, setCategoryAnalytics] = useState<
    Partial<AnalyticsData>
  >({});
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // Derived state
  const analyticsData: AnalyticsData | null = baseAnalytics
    ? { ...baseAnalytics, ...categoryAnalytics }
    : null;

  // Placeholder fetch functions for specialized categories - implementation pending
  const fetchInventoryData = () => {
    // TODO: Implement actual data fetching
    return {};
  };

  const fetchSegmentData = () => {
    // TODO: Implement actual data fetching
    return {};
  };

  const fetchAdAnalyticsData = () => {
    // TODO: Implement actual data fetching
    return {};
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: using merchant?.id instead of merchant object avoids infinite loop without React Compiler
  useEffect(() => {
    const controller = new AbortController();

    async function fetchAnalytics() {
      if (!merchant || !date.from || !date.to) return;

      setLoadingAnalytics(true);
      try {
        const queryParams = new URLSearchParams({
          startDate: date.from.toISOString(),
          endDate: date.to.toISOString(),
        });
        const response = await fetch(
          `/api/analytics?${queryParams.toString()}`,
          { signal: controller.signal }
        );
        if (response.ok) {
          const data = await response.json();
          setBaseAnalytics(data);
        } else {
          console.error(
            'Failed to fetch analytics:',
            response.status,
            response.statusText
          );
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Error fetching analytics:', error);
      } finally {
        setLoadingAnalytics(false);
      }
    }

    fetchAnalytics();

    return () => controller.abort();
  }, [merchant?.id, date]);

  // Fetch specialized data when category changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: using merchant?.id instead of merchant object avoids infinite loop without React Compiler
  useEffect(() => {
    let isCancelled = false;

    async function fetchCategoryData() {
      if (!merchant) return;

      let newData = {};

      try {
        if (activeCategory === 'inventory') {
          newData = await fetchInventoryData();
        } else if (activeCategory === 'segments') {
          newData = await fetchSegmentData();
        } else if (activeCategory === 'ads') {
          newData = await fetchAdAnalyticsData();
        }

        if (!isCancelled) {
          setCategoryAnalytics(newData);
        }
      } catch (error) {
        console.error('Error fetching category data:', error);
      }
    }

    fetchCategoryData();

    return () => {
      isCancelled = true;
    };
  }, [activeCategory, merchant?.id]);

  const handleExport = (format: 'csv' | 'pdf') => {
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
        exportAnalyticsAsCSV(analyticsData, date, merchant?.business_name);
        toast({
          title: 'CSV Exported',
          description: 'Your analytics report has been downloaded as CSV.',
        });
      } else {
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
        loading={loadingAnalytics}
        activeCategory={activeCategory}
        merchant={merchant}
      />
    </div>
  );
}
