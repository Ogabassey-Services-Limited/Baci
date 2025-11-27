'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useMerchant } from '@/hooks/use-merchant';
import { Loader2 } from 'lucide-react';
import { DraggableAnalyticsGrid, AnalyticsData } from '@/components/analytics/draggable-analytics-grid';
import { AnalyticsCategoryNav, AnalyticsCategory } from '@/components/analytics/analytics-category-nav';
import { AnalyticsFilters } from '@/components/analytics/analytics-filters';
import { exportAnalyticsAsCSV, exportAnalyticsAsPDF } from '@/lib/analytics-export';


/**
 * Render the analytics dashboard for a merchant, including date filters, category navigation, export controls, and a draggable analytics grid.
 *
 * Fetches analytics for the selected date range when merchant data and dates are available, shows a centered loading spinner while merchant data is loading, and provides CSV/PDF export actions with user-facing toasts.
 *
 * @returns The component's React element containing the analytics header, controls (category nav and filters), and the main analytics grid.
 */
export default function AnalyticsPage() {
    const { toast } = useToast();
    const { merchant, loading: merchantLoading } = useMerchant();
    const [date, setDate] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: new Date(new Date().setDate(new Date().getDate() - 7)),
        to: new Date(),
    });
    const searchParams = useSearchParams();
    const [activeCategory, setActiveCategory] = useState<AnalyticsCategory>(
        (searchParams.get('category') as AnalyticsCategory) || 'overview'
    );
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
    const [loadingAnalytics, setLoadingAnalytics] = useState(true);

    // Fetch analytics data
    useEffect(() => {
        async function fetchAnalytics() {
            if (!merchant || !date.from || !date.to) return;

            setLoadingAnalytics(true);
            try {
                const queryParams = new URLSearchParams({
                    startDate: date.from.toISOString(),
                    endDate: date.to.toISOString(),
                });
                const response = await fetch(`/api/analytics?${queryParams.toString()}`);
                if (response.ok) {
                    const data = await response.json();
                    setAnalyticsData(data);
                } else {
                    console.error('Failed to fetch analytics:', response.status, response.statusText);
                }
            } catch (error) {
                console.error('Error fetching analytics:', error);
            } finally {
                setLoadingAnalytics(false);
            }
        }

        fetchAnalytics();
    }, [merchant, date]);

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
                description: 'There was an error exporting your report. Please try again.',
                variant: 'destructive',
            });
            console.error('Export error:', error);
        }
    };

    if (merchantLoading) {
        return (
            <div className="flex flex-1 items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
                    <p className="text-muted-foreground">Deep dive into your store's performance.</p>
                </div>

                {/* AI Assistant Panel - Moved to Grid Controls */}
            </div>

            {/* Analytics Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-10 py-4 bg-background/80 backdrop-blur-md -mx-6 px-6 border-b">
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