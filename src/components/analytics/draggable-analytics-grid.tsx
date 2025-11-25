
'use client';

import { useState, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { AnalyticsCard } from './analytics-card';
import { RevenueChart, SalesByChannelChart } from './chart-components';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, Users, ShoppingBag, Activity, Check, Settings2, Percent, RefreshCcw } from 'lucide-react';
import { AnalyticsCategory } from './analytics-category-nav';
import { AIInsightsPanel } from './ai-insights-panel';
import { getCountryByCode } from '@/lib/countries';
import type { MerchantData } from '@/hooks/use-merchant';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DraggableAnalyticsGridProps {
    data: Record<string, unknown>;
    loading: boolean;
    activeCategory: AnalyticsCategory;
    merchant: MerchantData | null;
}

export function DraggableAnalyticsGrid({ data, loading, activeCategory, merchant }: DraggableAnalyticsGridProps) {
    const [isEditMode, setIsEditMode] = useState(false);

    const [layouts, setLayouts] = useState({
        lg: [
            // Right Sidebar
            { i: 'sales-channel', x: 9, y: 0, w: 3, h: 3 },

            // Row 1: Primary KPIs
            { i: 'summary-revenue', x: 0, y: 0, w: 3, h: 1 },
            { i: 'summary-orders', x: 3, y: 0, w: 3, h: 1 },
            { i: 'summary-profit', x: 3, y: 0, w: 3, h: 1 }, // Overlaps Orders
            { i: 'summary-customers', x: 6, y: 0, w: 3, h: 1 },
            { i: 'summary-tax', x: 6, y: 0, w: 3, h: 1 }, // Overlaps Customers

            // Row 2: Secondary KPIs
            { i: 'summary-active', x: 0, y: 1, w: 3, h: 1 },
            { i: 'summary-aov', x: 0, y: 1, w: 3, h: 1 }, // Overlaps Active
            { i: 'summary-margin', x: 3, y: 1, w: 3, h: 1 },
            { i: 'summary-refund-rate', x: 3, y: 1, w: 3, h: 1 }, // Overlaps Margin
            { i: 'summary-ltv', x: 6, y: 1, w: 3, h: 1 },

            // Row 3: Charts & Detailed Cards
            { i: 'revenue-chart', x: 0, y: 2, w: 6, h: 3 },
            { i: 'payment-methods', x: 6, y: 2, w: 3, h: 3 },

            // Row 4: Lists
            { i: 'recent-sales', x: 0, y: 5, w: 3, h: 3 },
            { i: 'top-products', x: 3, y: 5, w: 6, h: 3 },
        ],
        md: [
            { i: 'summary-revenue', x: 0, y: 0, w: 5, h: 1 },
            { i: 'summary-orders', x: 5, y: 0, w: 5, h: 1 },
            { i: 'summary-customers', x: 0, y: 1, w: 5, h: 1 },
            { i: 'summary-active', x: 5, y: 1, w: 5, h: 1 },

            { i: 'revenue-chart', x: 0, y: 4, w: 10, h: 3 },
            { i: 'recent-sales', x: 0, y: 7, w: 5, h: 3 },
            { i: 'sales-channel', x: 5, y: 7, w: 5, h: 3 },
            { i: 'top-products', x: 0, y: 10, w: 10, h: 3 },
            // Add missing finance cards to md layout
            { i: 'summary-aov', x: 0, y: 13, w: 5, h: 1 },
            { i: 'summary-margin', x: 5, y: 13, w: 5, h: 1 },
            { i: 'summary-ltv', x: 0, y: 14, w: 5, h: 1 },
            { i: 'summary-refund-rate', x: 5, y: 14, w: 5, h: 1 },
            { i: 'summary-profit', x: 0, y: 15, w: 5, h: 1 },
            { i: 'summary-tax', x: 5, y: 15, w: 5, h: 1 },
            { i: 'payment-methods', x: 0, y: 16, w: 10, h: 3 },
        ],
    });

    // Load saved layout from API on mount
    useEffect(() => {
        // TEMPORARILY DISABLED: To force new 12-col layout update for all users
        // async function fetchPreferences() {
        //     try {
        //         const response = await fetch('/api/dashboard/preferences');
        //         if (response.ok) {
        //             const pref = await response.json();
        //             if (pref.layout_config && pref.layout_config.length > 0) {
        //                 setLayouts({ ...layouts, lg: pref.layout_config });
        //             }
        //         }
        //     } catch (error) {
        //         console.error('Failed to load layout preferences:', error);
        //     }
        // }
        // fetchPreferences();
    }, []);

    // Save layout change
    const onLayoutChange = async (currentLayout: unknown, allLayouts: Record<string, unknown>) => {
        setLayouts(allLayouts);
        if (!isEditMode) return; // Only save if in edit mode (optional, but good for performance)

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
        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-32 bg-muted/20 animate-pulse rounded-2xl" />
                ))}
                <div className="col-span-1 md:col-span-3 h-96 bg-muted/20 animate-pulse rounded-2xl" />
                <div className="col-span-1 h-96 bg-muted/20 animate-pulse rounded-2xl" />
            </div>
        );
    }

    const { chartData: _chartData, recentSales: _recentSales, topProducts: _topProducts, salesByChannel: _salesByChannel } = data || {};

    // Filter widgets based on active category
    const isWidgetVisible = (key: string) => {
        if (activeCategory === 'overview') return true;

        const categoryMap: Record<string, string[]> = {
            finance: ['summary-revenue', 'revenue-chart', 'recent-sales', 'summary-profit', 'summary-tax', 'payment-methods', 'summary-aov', 'summary-margin', 'summary-ltv'],
            products: ['summary-orders', 'top-products', 'summary-refund-rate'],
            customers: ['summary-customers', 'summary-active'],
            marketing: ['sales-channel'],
        };

        return categoryMap[activeCategory]?.includes(key);
    };

    const summary = data?.summary || {
        revenue: { value: 0, change: 0 },
        customers: { value: 0, change: 0 },
        sales: { value: 0, change: 0 },
        activeNow: { value: 0, change: 0 },
        aov: { value: 0, change: 0 },
        grossMargin: { value: 0, change: 0 },
        ltv: { value: 0, change: 0 },
        refundRate: { value: 0, change: 0 },
    };

    // Mock data for finance cards (since API doesn't return these yet)
    const profit = { value: summary.revenue.value * 0.25, change: 12.5 }; // 25% margin
    const taxDue = { value: summary.revenue.value * 0.1, change: 5.2 }; // 10% tax

    const formatCurrency = (value: number) => {
        const country = merchant?.country ? getCountryByCode(merchant.country) : undefined;
        const locale = country ? `en-${country.code}` : 'en-US';
        const currency = country ? country.currency : 'USD';

        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
            currencyDisplay: 'symbol',
        }).format(value);
    };

    const formatPercent = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'percent',
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        }).format(value / 100);
    };

    return (
        <div className="w-full">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0 w-full">
                    <AIInsightsPanel activeCategory={activeCategory} />
                </div>
                <Button
                    variant={isEditMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsEditMode(!isEditMode)}
                    className="gap-2 flex-shrink-0"
                >
                    {isEditMode ? <Check className="w-4 h-4" /> : <Settings2 className="w-4 h-4" />}
                    {isEditMode ? 'Save Layout' : 'Customize Dashboard'}
                </Button>
            </div>

            <ResponsiveGridLayout
                className="layout"
                layouts={layouts}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                rowHeight={150}
                onLayoutChange={onLayoutChange}
                isDraggable={isEditMode}
                isResizable={isEditMode}
                draggableHandle=".drag-handle"
                margin={[16, 16]}
            >
                {isWidgetVisible('summary-revenue') && (
                    <div key="summary-revenue">
                        <AnalyticsCard title="Total Revenue 💰" value={formatCurrency(summary.revenue.value)} change={summary.revenue.change} trend={summary.revenue.change >= 0 ? 'up' : 'down'} icon={DollarSign} />
                    </div>
                )}
                {isWidgetVisible('summary-aov') && (
                    <div key="summary-aov">
                        <AnalyticsCard title="Avg. Order Value 🛒" value={formatCurrency(summary.aov?.value || 0)} change={summary.aov?.change || 0} trend={(summary.aov?.change || 0) >= 0 ? 'up' : 'down'} icon={DollarSign} />
                    </div>
                )}
                {isWidgetVisible('summary-margin') && (
                    <div key="summary-margin">
                        <AnalyticsCard title="Gross Margin % 📊" value={formatPercent(summary.grossMargin?.value || 0)} change={summary.grossMargin?.change || 0} trend={(summary.grossMargin?.change || 0) >= 0 ? 'up' : 'down'} icon={Percent} />
                    </div>
                )}
                {isWidgetVisible('summary-ltv') && (
                    <div key="summary-ltv">
                        <AnalyticsCard title="Customer LTV 💎" value={formatCurrency(summary.ltv?.value || 0)} change={summary.ltv?.change || 0} trend={(summary.ltv?.change || 0) >= 0 ? 'up' : 'down'} icon={Users} />
                    </div>
                )}
                {isWidgetVisible('summary-profit') && (
                    <div key="summary-profit">
                        <AnalyticsCard title="Net Profit (Est.) 📈" value={formatCurrency(profit.value)} change={profit.change} trend="up" icon={DollarSign} />
                    </div>
                )}
                {isWidgetVisible('summary-tax') && (
                    <div key="summary-tax">
                        <AnalyticsCard title="Tax Due (Est.) 🏛️" value={formatCurrency(taxDue.value)} change={taxDue.change} trend="down" icon={DollarSign} />
                    </div>
                )}
                {isWidgetVisible('payment-methods') && (
                    <div key="payment-methods">
                        <Card className="h-full border-none shadow-sm bg-white/60 dark:bg-black/40 backdrop-blur-xl">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Payment Methods 💳</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Credit Card</span>
                                        <span className="font-medium">65%</span>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full bg-primary w-[65%]" />
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>PayPal</span>
                                        <span className="font-medium">35%</span>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 w-[35%]" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
                {isWidgetVisible('summary-customers') && (
                    <div key="summary-customers">
                        <AnalyticsCard title="Customers 👥" value={summary.customers.value.toString()} change={summary.customers.change} trend="up" icon={Users} />
                    </div>
                )}
                {isWidgetVisible('summary-orders') && (
                    <div key="summary-orders">
                        <AnalyticsCard title="Total Orders 📦" value={summary.sales.value.toString()} change={summary.sales.change} trend="up" icon={ShoppingBag} />
                    </div>
                )}
                {isWidgetVisible('summary-refund-rate') && (
                    <div key="summary-refund-rate">
                        <AnalyticsCard title="Refund Rate ↩️" value={formatPercent(summary.refundRate?.value || 0)} change={summary.refundRate?.change || 0} trend={(summary.refundRate?.change || 0) <= 0 ? 'up' : 'down'} icon={RefreshCcw} />
                    </div>
                )}
                {isWidgetVisible('summary-active') && (
                    <div key="summary-active">
                        <AnalyticsCard title="Active Now 🟢" value={summary.activeNow.value.toString()} change={summary.activeNow.change} trend="up" icon={Activity} />
                    </div>
                )}
                {isWidgetVisible('revenue-chart') && (
                    <div key="revenue-chart">
                        <Card className="h-full border-none shadow-sm bg-white/60 dark:bg-black/40 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle>Revenue Over Time</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <RevenueChart data={data?.chartData || []} />
                            </CardContent>
                        </Card>
                    </div>
                )}
                {isWidgetVisible('recent-sales') && (
                    <div key="recent-sales">
                        <Card className="h-full border-none shadow-sm bg-white/60 dark:bg-black/40 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle>Recent Sales</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {data?.recentSales?.map((sale: Record<string, unknown>) => (
                                        <div key={sale.id as string} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                    {sale.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{sale.name}</p>
                                                    <p className="text-xs text-muted-foreground">{sale.email}</p>
                                                </div>
                                            </div>
                                            <p className="text-sm font-medium">{formatCurrency(sale.amount)}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
                {isWidgetVisible('sales-channel') && (
                    <div key="sales-channel">
                        <Card className="h-full border-none shadow-sm bg-white/60 dark:bg-black/40 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle>Sales by Channel 📊</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <SalesByChannelChart data={data?.salesByChannel || []} />
                            </CardContent>
                        </Card>
                    </div>
                )}
                {isWidgetVisible('top-products') && (
                    <div key="top-products">
                        <Card className="h-full border-none shadow-sm bg-white/60 dark:bg-black/40 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle>Top Products 🏆</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {data?.topProducts?.map((product: Record<string, unknown>, index: number) => (
                                        <div key={product.id as string} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                    #{index + 1}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{product.name}</p>
                                                    <p className="text-xs text-muted-foreground">{product.sales} sales</p>
                                                </div>
                                            </div>
                                            <p className="text-sm font-medium">{formatCurrency(product.revenue)}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

            </ResponsiveGridLayout>
        </div>
    );
}
