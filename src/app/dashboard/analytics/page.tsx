
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useMerchant } from '@/hooks/use-merchant';
import { Loader2 } from 'lucide-react';
import { DraggableAnalyticsGrid, AnalyticsData } from '@/components/analytics/draggable-analytics-grid';
import { AnalyticsCategoryNav, AnalyticsCategory } from '@/components/analytics/analytics-category-nav';
import { AnalyticsFilters } from '@/components/analytics/analytics-filters';
import { exportAnalyticsAsCSV, exportAnalyticsAsPDF } from '@/lib/analytics-export';


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

    // Fetch inventory data when inventory tab is active
    const fetchInventoryData = useCallback(async () => {
        try {
            const [alertsRes, forecastRes] = await Promise.all([
                fetch('/api/inventory/alerts?status=active'),
                fetch('/api/inventory/forecast'),
            ]);

            const alertsData = alertsRes.ok ? await alertsRes.json() : { alerts: [] };
            const forecastData = forecastRes.ok ? await forecastRes.json() : { forecasts: [] };

            return {
                inventoryAlerts: alertsData.alerts || [],
                inventoryForecasts: forecastData.forecasts || [],
                lowStockCount: alertsData.alerts?.filter((a: { alert_type: string }) => a.alert_type === 'low_stock').length || 0,
                outOfStockCount: alertsData.alerts?.filter((a: { alert_type: string }) => a.alert_type === 'out_of_stock').length || 0,
            };
        } catch (error) {
            console.error('Error fetching inventory data:', error);
            return {
                inventoryAlerts: [],
                inventoryForecasts: [],
                lowStockCount: 0,
                outOfStockCount: 0,
            };
        }
    }, []);

    // Fetch segment data when segments tab is active
    const fetchSegmentData = useCallback(async () => {
        try {
            const response = await fetch('/api/customers/segments');
            if (response.ok) {
                const data = await response.json();
                return {
                    segmentSummary: {
                        total_customers: data.total_customers || 0,
                        segments: data.segments || [],
                        at_risk_count: data.segments?.find((s: { segment: string; count: number }) => s.segment === 'At Risk')?.count || 0,
                        champions_count: data.segments?.find((s: { segment: string; count: number }) => s.segment === 'Champions')?.count || 0,
                    },
                };
            }
            return { segmentSummary: undefined };
        } catch (error) {
            console.error('Error fetching segment data:', error);
            return { segmentSummary: undefined };
        }
    }, []);

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

    // Fetch specialized data when category changes
    useEffect(() => {
        async function fetchCategoryData() {
            if (!merchant) return;

            if (activeCategory === 'inventory') {
                const inventoryData = await fetchInventoryData();
                setAnalyticsData(prev => prev ? { ...prev, ...inventoryData } : inventoryData);
            } else if (activeCategory === 'segments') {
                const segmentData = await fetchSegmentData();
                setAnalyticsData(prev => prev ? { ...prev, ...segmentData } : segmentData);
            }
        }

        fetchCategoryData();
    }, [activeCategory, merchant, fetchInventoryData, fetchSegmentData]);

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
                <Loader2 className="h-8 w-8 motion-safe:animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent">
                        Analytics 📈
                    </h1>
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
