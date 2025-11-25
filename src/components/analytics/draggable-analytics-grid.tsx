'use client';

import { useState, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { AnalyticsCard } from './analytics-card';
import { RevenueChart, OrdersChart, SalesByChannelChart } from './chart-components';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DollarSign, Users, ShoppingBag, Activity } from 'lucide-react';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DraggableAnalyticsGridProps {
    data: any;
    loading: boolean;
}

export function DraggableAnalyticsGrid({ data, loading }: DraggableAnalyticsGridProps) {
    const [layouts, setLayouts] = useState({
        lg: [
            { i: 'summary-revenue', x: 0, y: 0, w: 3, h: 1 },
            { i: 'summary-orders', x: 3, y: 0, w: 3, h: 1 },
            { i: 'summary-customers', x: 6, y: 0, w: 3, h: 1 },
            { i: 'summary-active', x: 9, y: 0, w: 3, h: 1 },
            { i: 'revenue-chart', x: 0, y: 1, w: 8, h: 4 },
            { i: 'recent-sales', x: 8, y: 1, w: 4, h: 4 },
            { i: 'sales-channel', x: 0, y: 5, w: 4, h: 3 },
            { i: 'top-products', x: 4, y: 5, w: 8, h: 3 },
        ],
    });

    // Load saved layout from API on mount
    useEffect(() => {
        async function fetchPreferences() {
            try {
                const response = await fetch('/api/dashboard/preferences');
                if (response.ok) {
                    const pref = await response.json();
                    if (pref.layout_config && pref.layout_config.length > 0) {
                        setLayouts({ lg: pref.layout_config });
                    }
                }
            } catch (error) {
                console.error('Failed to load layout preferences:', error);
            }
        }
        fetchPreferences();
    }, []);

    // Save layout change
    const onLayoutChange = async (currentLayout: any, allLayouts: any) => {
        setLayouts(allLayouts);
        try {
            await fetch('/api/dashboard/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ layout_config: currentLayout }),
            });
        } catch (error) {
            console.error('Failed to save layout:', error);
        }
    };

    if (loading) {
        return <div className="p-8 text-center">Loading analytics...</div>;
    }

    const { summary, chartData, recentSales, topProducts, salesByChannel } = data || {};

    return (
        <ResponsiveGridLayout
            className="layout"
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={100}
            onLayoutChange={onLayoutChange}
            draggableHandle=".drag-handle"
        >
            <div key="summary-revenue">
                <AnalyticsCard
                    title="Total Revenue"
                    value={`$${summary?.revenue?.value?.toLocaleString() || '0'}`}
                    change={summary?.revenue?.change}
                    icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
                    className="h-full drag-handle cursor-move"
                />
            </div>
            <div key="summary-orders">
                <AnalyticsCard
                    title="Orders"
                    value={summary?.sales?.value || 0}
                    change={summary?.sales?.change}
                    icon={<ShoppingBag className="h-4 w-4 text-muted-foreground" />}
                    className="h-full drag-handle cursor-move"
                />
            </div>
            <div key="summary-customers">
                <AnalyticsCard
                    title="Customers"
                    value={summary?.customers?.value || 0}
                    change={summary?.customers?.change}
                    icon={<Users className="h-4 w-4 text-muted-foreground" />}
                    className="h-full drag-handle cursor-move"
                />
            </div>
            <div key="summary-active">
                <AnalyticsCard
                    title="Active Now"
                    value={summary?.activeNow?.value || 0}
                    change={summary?.activeNow?.change}
                    icon={<Activity className="h-4 w-4 text-muted-foreground" />}
                    className="h-full drag-handle cursor-move"
                />
            </div>

            <div key="revenue-chart">
                <Card className="h-full flex flex-col">
                    <CardHeader className="drag-handle cursor-move">
                        <CardTitle>Revenue Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0">
                        <RevenueChart data={chartData || []} className="h-full w-full" />
                    </CardContent>
                </Card>
            </div>

            <div key="recent-sales">
                <Card className="h-full flex flex-col">
                    <CardHeader className="drag-handle cursor-move">
                        <CardTitle>Recent Sales</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto">
                        <div className="space-y-8">
                            {recentSales?.map((sale: any) => (
                                <div key={sale.id} className="flex items-center">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={`/avatars/${sale.avatar}.png`} alt="Avatar" />
                                        <AvatarFallback>{sale.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="ml-4 space-y-1">
                                        <p className="text-sm font-medium leading-none">{sale.name}</p>
                                        <p className="text-sm text-muted-foreground">{sale.email}</p>
                                    </div>
                                    <div className="ml-auto font-medium">+${sale.amount}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div key="sales-channel">
                <Card className="h-full flex flex-col">
                    <CardHeader className="drag-handle cursor-move">
                        <CardTitle>Sales by Channel</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0">
                        <SalesByChannelChart data={salesByChannel || []} className="h-full w-full" />
                    </CardContent>
                </Card>
            </div>

            <div key="top-products">
                <Card className="h-full flex flex-col">
                    <CardHeader className="drag-handle cursor-move">
                        <CardTitle>Top Products</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto">
                        <div className="space-y-4">
                            {topProducts?.map((product: any) => (
                                <div key={product.product_id} className="flex items-center justify-between border-b pb-2 last:border-0">
                                    <div>
                                        <p className="font-medium">{product.name}</p>
                                        <p className="text-sm text-muted-foreground">{product.times_sold} sold</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-medium">${product.total_revenue}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </ResponsiveGridLayout>
    );
}
