'use client';

import { useState, useEffect } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { RevenueChart, SalesByChannelChart } from './chart-components';
import { Button } from '@/components/ui/button';
import { DollarSign, Users, ShoppingBag, Activity, Check, Settings2, Percent, RefreshCcw, Package, AlertTriangle, TrendingUp, Target, Crown } from 'lucide-react';
import { AnalyticsCategory } from './analytics-category-nav';
import { AIInsightsPanel } from './ai-insights-panel';
import { getCountryByCode } from '@/lib/countries';
import type { MerchantData } from '@/hooks/use-merchant';
import { BentoCard } from '@/components/ui/bento-card';
import { cn } from '@/lib/utils';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface MetricData {
    value: number;
    change: number;
}

interface AnalyticsSummary {
    revenue: MetricData;
    customers: MetricData;
    sales: MetricData;
    activeNow: MetricData;
    aov?: MetricData;
    grossMargin?: MetricData;
    ltv?: MetricData;
    refundRate?: MetricData;
}

interface SaleRecord {
    id: string;
    name: string;
    email: string;
    time: string;
    amount: number;
}

interface ProductRecord {
    id: string;
    name: string;
    sku?: string;
    revenue: number;
    units?: number;
    sales?: number;
}

interface InventoryAlert {
    id: string;
    product_id: string;
    product_name?: string;
    alert_type: 'low_stock' | 'out_of_stock' | 'predicted_stockout';
    current_stock: number;
    days_until_stockout?: number;
    status: string;
}

interface InventoryForecast {
    product_id: string;
    product_name: string;
    current_stock: number;
    avg_daily_sales: number;
    days_of_stock: number;
    predicted_stockout_date?: string;
    sales_trend: 'increasing' | 'decreasing' | 'stable';
}

interface CustomerSegment {
    segment: string;
    count: number;
    avg_clv: number;
    avg_order_value: number;
    churn_risk: number;
}

interface SegmentSummary {
    total_customers: number;
    segments: CustomerSegment[];
    at_risk_count: number;
    champions_count: number;
}

export interface AnalyticsData {
    summary?: AnalyticsSummary;
    chartData?: Array<{ date: string; revenue: number }>;
    revenueOverTime?: unknown[];
    salesByChannel?: Array<{ name: string; value: number }>;
    recentSales?: SaleRecord[];
    topProducts?: ProductRecord[];
    paymentMethods?: Array<{ name: string; value: number }>;
    // Inventory data
    inventoryAlerts?: InventoryAlert[];
    inventoryForecasts?: InventoryForecast[];
    lowStockCount?: number;
    outOfStockCount?: number;
    // Segment data
    segmentSummary?: SegmentSummary;
}

interface Layouts {
    lg: Layout[];
    md: Layout[];
    [key: string]: Layout[];
}

interface DraggableAnalyticsGridProps {
    data: AnalyticsData;
    loading: boolean;
    activeCategory: AnalyticsCategory;
    merchant: MerchantData | null;
}

export function DraggableAnalyticsGrid({ data, loading, activeCategory, merchant }: DraggableAnalyticsGridProps) {
    const [isEditMode, setIsEditMode] = useState(false);

    // Dynamically load grid layout CSS to avoid render-blocking
    useEffect(() => {
        import('react-grid-layout/css/styles.css');
        import('react-resizable/css/styles.css');
    }, []);

    const [layouts, setLayouts] = useState<Layouts>({
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

            // Inventory widgets
            { i: 'inventory-alerts', x: 0, y: 0, w: 4, h: 2 },
            { i: 'inventory-forecast', x: 4, y: 0, w: 4, h: 3 },
            { i: 'inventory-summary', x: 8, y: 0, w: 4, h: 1 },
            { i: 'low-stock-products', x: 0, y: 2, w: 4, h: 2 },

            // Segment widgets
            { i: 'segment-overview', x: 0, y: 0, w: 4, h: 2 },
            { i: 'segment-distribution', x: 4, y: 0, w: 4, h: 2 },
            { i: 'at-risk-customers', x: 8, y: 0, w: 4, h: 2 },
            { i: 'champions-list', x: 0, y: 2, w: 6, h: 2 },
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
    const onLayoutChange = (currentLayout: Layout[], allLayouts: Layouts) => {
        setLayouts(allLayouts);
        if (!isEditMode) return; // Only save if in edit mode (optional, but good for performance)

        // Fire-and-forget pattern for saving layout preferences
        fetch('/api/dashboard/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ layout_config: currentLayout }),
        }).catch((error) => {
            console.error('Failed to save layout:', error);
        });
    };

    if (loading) {
        return (
            <div className="space-y-4">
                {/* AI Insights skeleton - already handled by AIInsightsPanel */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0 w-full">
                        <AIInsightsPanel activeCategory={activeCategory} />
                    </div>
                </div>
                {/* Grid skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-32 bg-muted/10 rounded-2xl border border-border/50 overflow-hidden relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                            <div className="p-4 space-y-2">
                                <div className="h-3 w-20 bg-muted/30 rounded" />
                                <div className="h-6 w-24 bg-muted/20 rounded" />
                            </div>
                        </div>
                    ))}
                    <div className="col-span-1 md:col-span-3 h-80 bg-muted/10 rounded-2xl border border-border/50 overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                        <div className="p-4">
                            <div className="h-4 w-32 bg-muted/30 rounded mb-4" />
                            <div className="h-full w-full flex items-end gap-2 pb-8">
                                {[40, 65, 45, 80, 55, 70].map((h, i) => (
                                    <div key={i} className="flex-1 bg-muted/20 rounded-t" style={{ height: `${h}%` }} />
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="col-span-1 h-80 bg-muted/10 rounded-2xl border border-border/50 overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                    </div>
                </div>
            </div>
        );
    }

    const { chartData: _chartData, recentSales: _recentSales, topProducts: _topProducts, salesByChannel: _salesByChannel } = data || {};

    // Filter widgets based on active category
    const isWidgetVisible = (key: string) => {
        // Overview shows all standard widgets but not specialized inventory/segment widgets
        if (activeCategory === 'overview') {
            const specializedWidgets = [
                'inventory-alerts', 'inventory-forecast', 'inventory-summary', 'low-stock-products',
                'segment-overview', 'segment-distribution', 'at-risk-customers', 'champions-list'
            ];
            return !specializedWidgets.includes(key);
        }

        const categoryMap: Record<string, string[]> = {
            finance: ['summary-revenue', 'revenue-chart', 'recent-sales', 'summary-profit', 'summary-tax', 'payment-methods', 'summary-aov', 'summary-margin', 'summary-ltv'],
            products: ['summary-orders', 'top-products', 'summary-refund-rate'],
            customers: ['summary-customers', 'summary-active'],
            marketing: ['sales-channel'],
            inventory: ['inventory-alerts', 'inventory-forecast', 'inventory-summary', 'low-stock-products'],
            segments: ['segment-overview', 'segment-distribution', 'at-risk-customers', 'champions-list'],
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

    // Helper to render metric cards using BentoCard
    const renderMetricCard = (key: string, title: string, value: string, change: number, icon: React.ElementType, trend: 'up' | 'down') => (
        <div key={key}>
            <BentoCard title={title} icon={icon} className="h-full">
                <div className="space-y-1">
                    <div className="text-2xl font-bold tracking-tight">{value}</div>
                    <div className={cn("flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit",
                        trend === 'up' ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400")}>
                        <span>{change >= 0 ? '+' : ''}{change}%</span>
                    </div>
                </div>
            </BentoCard>
        </div>
    );

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
                {isWidgetVisible('summary-revenue') && renderMetricCard('summary-revenue', 'Total Revenue 💰', formatCurrency(summary.revenue.value), summary.revenue.change, DollarSign, summary.revenue.change >= 0 ? 'up' : 'down')}
                {isWidgetVisible('summary-aov') && renderMetricCard('summary-aov', 'Avg. Order Value 🛒', formatCurrency(summary.aov?.value || 0), summary.aov?.change || 0, DollarSign, (summary.aov?.change || 0) >= 0 ? 'up' : 'down')}
                {isWidgetVisible('summary-margin') && renderMetricCard('summary-margin', 'Gross Margin % 📊', formatPercent(summary.grossMargin?.value || 0), summary.grossMargin?.change || 0, Percent, (summary.grossMargin?.change || 0) >= 0 ? 'up' : 'down')}
                {isWidgetVisible('summary-ltv') && renderMetricCard('summary-ltv', 'Customer LTV 💎', formatCurrency(summary.ltv?.value || 0), summary.ltv?.change || 0, Users, (summary.ltv?.change || 0) >= 0 ? 'up' : 'down')}
                {isWidgetVisible('summary-profit') && renderMetricCard('summary-profit', 'Net Profit (Est.) 📈', formatCurrency(profit.value), profit.change, DollarSign, 'up')}
                {isWidgetVisible('summary-tax') && renderMetricCard('summary-tax', 'Tax Due (Est.) 🏛️', formatCurrency(taxDue.value), taxDue.change, DollarSign, 'down')}

                {isWidgetVisible('payment-methods') && (
                    <div key="payment-methods">
                        <BentoCard title="Payment Methods 💳" className="h-full">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Credit Card</span>
                                        <span className="font-medium">65%</span>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full bg-primary w-[65%]" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>PayPal</span>
                                        <span className="font-medium">35%</span>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 w-[35%]" />
                                    </div>
                                </div>
                            </div>
                        </BentoCard>
                    </div>
                )}

                {isWidgetVisible('summary-customers') && renderMetricCard('summary-customers', 'Customers 👥', summary.customers.value.toString(), summary.customers.change, Users, 'up')}
                {isWidgetVisible('summary-orders') && renderMetricCard('summary-orders', 'Total Orders 📦', summary.sales.value.toString(), summary.sales.change, ShoppingBag, 'up')}
                {isWidgetVisible('summary-refund-rate') && renderMetricCard('summary-refund-rate', 'Refund Rate ↩️', formatPercent(summary.refundRate?.value || 0), summary.refundRate?.change || 0, RefreshCcw, (summary.refundRate?.change || 0) <= 0 ? 'up' : 'down')}
                {isWidgetVisible('summary-active') && renderMetricCard('summary-active', 'Active Now 🟢', summary.activeNow.value.toString(), summary.activeNow.change, Activity, 'up')}

                {isWidgetVisible('revenue-chart') && (
                    <div key="revenue-chart">
                        <BentoCard title="Revenue Over Time" className="h-full">
                            <RevenueChart data={data?.chartData || []} />
                        </BentoCard>
                    </div>
                )}
                {isWidgetVisible('recent-sales') && (
                    <div key="recent-sales">
                        <BentoCard title="Recent Sales" className="h-full">
                            <div className="space-y-4 custom-scrollbar overflow-y-auto max-h-[250px] pr-2">
                                {data?.recentSales?.map((sale) => (
                                    <div key={sale.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
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
                        </BentoCard>
                    </div>
                )}
                {isWidgetVisible('sales-channel') && (
                    <div key="sales-channel">
                        <BentoCard title="Sales by Channel 📊" className="h-full">
                            <SalesByChannelChart data={data?.salesByChannel || []} />
                        </BentoCard>
                    </div>
                )}
                {isWidgetVisible('top-products') && (
                    <div key="top-products">
                        <BentoCard title="Top Products 🏆" className="h-full">
                            <div className="space-y-4 custom-scrollbar overflow-y-auto max-h-[250px] pr-2">
                                {data?.topProducts?.map((product, index) => (
                                    <div key={product.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                #{index + 1}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">{product.name}</p>
                                                <p className="text-xs text-muted-foreground">{product.sales ?? 0} sales</p>
                                            </div>
                                        </div>
                                        <p className="text-sm font-medium">{formatCurrency(product.revenue)}</p>
                                    </div>
                                ))}
                            </div>
                        </BentoCard>
                    </div>
                )}

                {/* Inventory Widgets */}
                {isWidgetVisible('inventory-summary') && (
                    <div key="inventory-summary">
                        <BentoCard title="Inventory Health" icon={Package} className="h-full">
                            <div className="flex items-center justify-between">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-red-500">{data?.outOfStockCount || 0}</div>
                                    <div className="text-xs text-muted-foreground">Out of Stock</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-amber-500">{data?.lowStockCount || 0}</div>
                                    <div className="text-xs text-muted-foreground">Low Stock</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-green-500">{(data?.inventoryAlerts?.filter(a => a.status === 'resolved').length) || 0}</div>
                                    <div className="text-xs text-muted-foreground">Resolved</div>
                                </div>
                            </div>
                        </BentoCard>
                    </div>
                )}

                {isWidgetVisible('inventory-alerts') && (
                    <div key="inventory-alerts">
                        <BentoCard title="Stock Alerts" icon={AlertTriangle} className="h-full">
                            <div className="space-y-3 custom-scrollbar overflow-y-auto max-h-[200px] pr-2">
                                {(data?.inventoryAlerts || []).length === 0 ? (
                                    <div className="text-center py-4 text-muted-foreground">
                                        <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No active alerts</p>
                                    </div>
                                ) : (
                                    data?.inventoryAlerts?.slice(0, 5).map((alert) => (
                                        <div key={alert.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                                            <div className="flex items-center gap-2">
                                                <div className={cn("w-2 h-2 rounded-full",
                                                    alert.alert_type === 'out_of_stock' ? 'bg-red-500' :
                                                    alert.alert_type === 'low_stock' ? 'bg-amber-500' : 'bg-blue-500'
                                                )} />
                                                <div>
                                                    <p className="text-sm font-medium">{alert.product_name || 'Unknown Product'}</p>
                                                    <p className="text-xs text-muted-foreground capitalize">{alert.alert_type.replace('_', ' ')}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold">{alert.current_stock}</p>
                                                <p className="text-xs text-muted-foreground">in stock</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </BentoCard>
                    </div>
                )}

                {isWidgetVisible('inventory-forecast') && (
                    <div key="inventory-forecast">
                        <BentoCard title="Stock Forecast" icon={TrendingUp} className="h-full">
                            <div className="space-y-3 custom-scrollbar overflow-y-auto max-h-[300px] pr-2">
                                {(data?.inventoryForecasts || []).length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No forecast data available</p>
                                        <p className="text-xs">Add products with stock tracking enabled</p>
                                    </div>
                                ) : (
                                    data?.inventoryForecasts?.slice(0, 8).map((forecast) => (
                                        <div key={forecast.product_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{forecast.product_name}</p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span>{forecast.current_stock} units</span>
                                                    <span>•</span>
                                                    <span>{forecast.avg_daily_sales}/day</span>
                                                </div>
                                            </div>
                                            <div className="text-right ml-2">
                                                <p className={cn("text-sm font-bold",
                                                    forecast.days_of_stock <= 7 ? 'text-red-500' :
                                                    forecast.days_of_stock <= 14 ? 'text-amber-500' : 'text-green-500'
                                                )}>
                                                    {Math.round(forecast.days_of_stock)} days
                                                </p>
                                                <div className={cn("text-xs flex items-center gap-1 justify-end",
                                                    forecast.sales_trend === 'increasing' ? 'text-green-500' :
                                                    forecast.sales_trend === 'decreasing' ? 'text-red-500' : 'text-muted-foreground'
                                                )}>
                                                    {forecast.sales_trend === 'increasing' && '↑'}
                                                    {forecast.sales_trend === 'decreasing' && '↓'}
                                                    {forecast.sales_trend === 'stable' && '→'}
                                                    {forecast.sales_trend}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </BentoCard>
                    </div>
                )}

                {isWidgetVisible('low-stock-products') && (
                    <div key="low-stock-products">
                        <BentoCard title="Low Stock Products" icon={Package} className="h-full">
                            <div className="space-y-2 custom-scrollbar overflow-y-auto max-h-[200px] pr-2">
                                {(data?.inventoryForecasts?.filter(f => f.days_of_stock <= 14) || []).length === 0 ? (
                                    <div className="text-center py-4 text-muted-foreground">
                                        <p className="text-sm">All products well stocked</p>
                                    </div>
                                ) : (
                                    data?.inventoryForecasts?.filter(f => f.days_of_stock <= 14).slice(0, 5).map((product) => (
                                        <div key={product.product_id} className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10">
                                            <span className="text-sm truncate flex-1">{product.product_name}</span>
                                            <span className="text-sm font-bold text-amber-600 ml-2">{product.current_stock} left</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </BentoCard>
                    </div>
                )}

                {/* Customer Segment Widgets */}
                {isWidgetVisible('segment-overview') && (
                    <div key="segment-overview">
                        <BentoCard title="Segment Overview" icon={Target} className="h-full">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Total Customers</span>
                                    <span className="text-2xl font-bold">{data?.segmentSummary?.total_customers || 0}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-lg bg-green-500/10 text-center">
                                        <Crown className="w-5 h-5 mx-auto mb-1 text-green-600" />
                                        <div className="text-lg font-bold text-green-600">{data?.segmentSummary?.champions_count || 0}</div>
                                        <div className="text-xs text-muted-foreground">Champions</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-red-500/10 text-center">
                                        <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-red-600" />
                                        <div className="text-lg font-bold text-red-600">{data?.segmentSummary?.at_risk_count || 0}</div>
                                        <div className="text-xs text-muted-foreground">At Risk</div>
                                    </div>
                                </div>
                            </div>
                        </BentoCard>
                    </div>
                )}

                {isWidgetVisible('segment-distribution') && (
                    <div key="segment-distribution">
                        <BentoCard title="Segment Distribution" icon={Users} className="h-full">
                            <div className="space-y-3">
                                {(data?.segmentSummary?.segments || []).map((segment) => {
                                    const total = data?.segmentSummary?.total_customers || 1;
                                    const percentage = Math.round((segment.count / total) * 100);
                                    const colorMap: Record<string, string> = {
                                        'Champions': 'bg-green-500',
                                        'Loyal': 'bg-blue-500',
                                        'Potential': 'bg-purple-500',
                                        'New': 'bg-cyan-500',
                                        'At Risk': 'bg-amber-500',
                                        'Hibernating': 'bg-orange-500',
                                        'Lost': 'bg-red-500',
                                    };
                                    return (
                                        <div key={segment.segment} className="space-y-1">
                                            <div className="flex justify-between text-sm">
                                                <span>{segment.segment}</span>
                                                <span className="font-medium">{segment.count} ({percentage}%)</span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className={cn("h-full transition-all", colorMap[segment.segment] || 'bg-primary')}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                                {(data?.segmentSummary?.segments || []).length === 0 && (
                                    <div className="text-center py-4 text-muted-foreground">
                                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No segment data yet</p>
                                    </div>
                                )}
                            </div>
                        </BentoCard>
                    </div>
                )}

                {isWidgetVisible('at-risk-customers') && (
                    <div key="at-risk-customers">
                        <BentoCard title="At-Risk Customers" icon={AlertTriangle} className="h-full">
                            <div className="space-y-2">
                                <p className="text-sm text-muted-foreground mb-3">
                                    Customers who haven&apos;t purchased recently and may churn
                                </p>
                                <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                                    <div>
                                        <div className="text-2xl font-bold text-red-600">{data?.segmentSummary?.at_risk_count || 0}</div>
                                        <div className="text-xs text-muted-foreground">customers at risk</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-medium">
                                            {data?.segmentSummary?.segments?.find(s => s.segment === 'At Risk')?.avg_clv
                                                ? formatCurrency(data.segmentSummary.segments.find(s => s.segment === 'At Risk')!.avg_clv)
                                                : 'N/A'}
                                        </div>
                                        <div className="text-xs text-muted-foreground">avg. CLV</div>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Consider re-engagement campaigns to win them back
                                </p>
                            </div>
                        </BentoCard>
                    </div>
                )}

                {isWidgetVisible('champions-list') && (
                    <div key="champions-list">
                        <BentoCard title="Champion Customers" icon={Crown} className="h-full">
                            <div className="space-y-2">
                                <p className="text-sm text-muted-foreground mb-3">
                                    Your most valuable customers - frequent buyers with high spend
                                </p>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="p-3 rounded-lg bg-green-500/10 text-center">
                                        <div className="text-lg font-bold text-green-600">{data?.segmentSummary?.champions_count || 0}</div>
                                        <div className="text-xs text-muted-foreground">Champions</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-muted/30 text-center">
                                        <div className="text-lg font-bold">
                                            {data?.segmentSummary?.segments?.find(s => s.segment === 'Champions')?.avg_order_value
                                                ? formatCurrency(data.segmentSummary.segments.find(s => s.segment === 'Champions')!.avg_order_value)
                                                : 'N/A'}
                                        </div>
                                        <div className="text-xs text-muted-foreground">Avg Order</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-muted/30 text-center">
                                        <div className="text-lg font-bold">
                                            {data?.segmentSummary?.segments?.find(s => s.segment === 'Champions')?.avg_clv
                                                ? formatCurrency(data.segmentSummary.segments.find(s => s.segment === 'Champions')!.avg_clv)
                                                : 'N/A'}
                                        </div>
                                        <div className="text-xs text-muted-foreground">Avg CLV</div>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Reward these customers with exclusive offers and early access
                                </p>
                            </div>
                        </BentoCard>
                    </div>
                )}

            </ResponsiveGridLayout>
        </div>
    );
}
