
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useMerchant } from '@/hooks/use-merchant';
import { Loader2 } from 'lucide-react';
import { DraggableAnalyticsGrid } from '@/components/analytics/draggable-analytics-grid';
import { AnalyticsCategoryNav, AnalyticsCategory } from '@/components/analytics/analytics-category-nav';
import { AnalyticsFilters } from '@/components/analytics/analytics-filters';


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
    const [analyticsData, setAnalyticsData] = useState<any>(null);
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
                    onExport={() => toast({ title: "Exporting Report", description: "Your report will be ready shortly." })}
                />
            </div>

            {/* Main Analytics Grid */}
            <DraggableAnalyticsGrid
                data={analyticsData}
                loading={loadingAnalytics}
                activeCategory={activeCategory}
                merchant={merchant}
            />
        </div>
    );
}
