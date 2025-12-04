'use server';

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export interface DashboardMetrics {
    revenue: {
        value: number;
        change: number;
    };
    customers: {
        value: number;
        change: number;
    };
    orders: {
        value: number;
        change: number;
    };
    activeNow: {
        value: number;
        change: number;
    };
    fulfillmentRate: number;
    aov: number;
}

export interface MonthlyChartData {
    month: string;
    revenue: number;
    profit: number;
    orders: number;
}

export interface RecentSale {
    id: string;
    name: string;
    email: string;
    amount: number;
    status: 'Completed' | 'Processing' | 'Failed' | 'Pending';
}

export async function getDashboardMetrics(merchantId: string): Promise<DashboardMetrics> {
    try {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        // Get all orders for this merchant with shipping status
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('id, total, created_at, payment_status, shipping_status')
            .eq('merchant_id', merchantId);

        if (ordersError) {
            console.error('Error fetching orders:', ordersError);
        }

        // Get unique customers (by email) for current period
        const { data: customerData, error: customersError } = await supabase
            .from('orders')
            .select('customer_email, created_at')
            .eq('merchant_id', merchantId);

        if (customersError) {
            console.error('Error fetching customers:', customersError);
        }

        // Calculate current period metrics (last 30 days)
        const currentPeriodOrders = orders?.filter(o => new Date(o.created_at) >= thirtyDaysAgo) || [];
        const previousPeriodOrders = orders?.filter(o => {
            const date = new Date(o.created_at);
            return date >= sixtyDaysAgo && date < thirtyDaysAgo;
        }) || [];

        // Revenue calculations
        const currentRevenue = currentPeriodOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
        const previousRevenue = previousPeriodOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
        const revenueChange = previousRevenue > 0
            ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100)
            : currentRevenue > 0 ? 100 : 0;

        // Orders calculations
        const currentOrdersCount = currentPeriodOrders.length;
        const previousOrdersCount = previousPeriodOrders.length;
        const ordersChange = previousOrdersCount > 0
            ? Math.round(((currentOrdersCount - previousOrdersCount) / previousOrdersCount) * 100)
            : currentOrdersCount > 0 ? 100 : 0;

        // Customer calculations
        const currentCustomers = new Set(
            customerData?.filter(o => new Date(o.created_at) >= thirtyDaysAgo).map(o => o.customer_email)
        ).size;
        const previousCustomers = new Set(
            customerData?.filter(o => {
                const date = new Date(o.created_at);
                return date >= sixtyDaysAgo && date < thirtyDaysAgo;
            }).map(o => o.customer_email)
        ).size;
        const customersChange = previousCustomers > 0
            ? Math.round(((currentCustomers - previousCustomers) / previousCustomers) * 100)
            : currentCustomers > 0 ? 100 : 0;

        // Active now - orders in the last hour as a proxy for activity
        const recentOrders = orders?.filter(o => new Date(o.created_at) >= oneHourAgo).length || 0;

        // Fulfillment rate calculation
        const fulfilledStatuses = ['shipped', 'delivered'];
        const fulfilledOrders = currentPeriodOrders.filter(o =>
            fulfilledStatuses.includes(o.shipping_status || '')
        ).length;
        const fulfillmentRate = currentOrdersCount > 0
            ? Math.round((fulfilledOrders / currentOrdersCount) * 100)
            : 0;

        // Average Order Value
        const aov = currentOrdersCount > 0 ? currentRevenue / currentOrdersCount : 0;

        // Total unique customers all time
        const uniqueCustomers = new Set(customerData?.map(o => o.customer_email) || []).size;
        // Total revenue all time
        const totalRevenue = orders?.reduce((sum, order) => sum + (Number(order.total) || 0), 0) || 0;

        return {
            revenue: {
                value: totalRevenue,
                change: revenueChange,
            },
            customers: {
                value: uniqueCustomers,
                change: customersChange,
            },
            orders: {
                value: orders?.length || 0,
                change: ordersChange,
            },
            activeNow: {
                value: recentOrders,
                change: 0,
            },
            fulfillmentRate,
            aov,
        };
    } catch (error) {
        console.error('Failed to fetch dashboard metrics:', error);
        return {
            revenue: { value: 0, change: 0 },
            customers: { value: 0, change: 0 },
            orders: { value: 0, change: 0 },
            activeNow: { value: 0, change: 0 },
            fulfillmentRate: 0,
            aov: 0,
        };
    }
}

export async function getRecentSales(merchantId: string, limit = 5): Promise<RecentSale[]> {
    try {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        const { data: orders, error } = await supabase
            .from('orders')
            .select('id, customer_name, customer_email, total, payment_status')
            .eq('merchant_id', merchantId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching recent sales:', error);
            return [];
        }

        return (orders || []).map(order => ({
            id: order.id,
            name: order.customer_name || 'Unknown Customer',
            email: order.customer_email || 'no-email@example.com',
            amount: Number(order.total) || 0,
            status: order.payment_status === 'paid' ? 'Completed' :
                order.payment_status === 'unpaid' ? 'Pending' : 'Failed',
        }));
    } catch (error) {
        console.error('Failed to fetch recent sales:', error);
        return [];
    }
}

export async function getMonthlyChartData(merchantId: string): Promise<MonthlyChartData[]> {
    try {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        // Get orders from the last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // Get orders with their items and product cost prices for profit calculation
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select(`
                id,
                total,
                created_at,
                order_items (
                    quantity,
                    price,
                    product_id
                )
            `)
            .eq('merchant_id', merchantId)
            .eq('payment_status', 'paid')
            .gte('created_at', sixMonthsAgo.toISOString());

        if (ordersError) {
            console.error('Error fetching monthly chart data:', ordersError);
            return [];
        }

        // Get all product cost prices for profit calculation
        const { data: products } = await supabase
            .from('products')
            .select('id, cost_price')
            .eq('merchant_id', merchantId);

        const productCosts = new Map<string, number>();
        for (const product of products || []) {
            productCosts.set(product.id, Number(product.cost_price) || 0);
        }

        // Group orders by month
        const monthlyData = new Map<string, { revenue: number; profit: number; orders: number }>();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Initialize last 6 months with zero values
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            monthlyData.set(monthKey, { revenue: 0, profit: 0, orders: 0 });
        }

        // Aggregate order data with profit calculation
        for (const order of orders || []) {
            const date = new Date(order.created_at);
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;

            if (monthlyData.has(monthKey)) {
                const current = monthlyData.get(monthKey)!;
                const orderTotal = Number(order.total) || 0;
                current.revenue += orderTotal;
                current.orders += 1;

                // Calculate profit from order items
                let orderCost = 0;
                for (const item of order.order_items || []) {
                    const costPrice = item.product_id ? productCosts.get(item.product_id) || 0 : 0;
                    orderCost += costPrice * (item.quantity || 1);
                }
                current.profit += orderTotal - orderCost;
            }
        }

        // Convert to array format
        const result: MonthlyChartData[] = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            const data = monthlyData.get(monthKey) || { revenue: 0, profit: 0, orders: 0 };

            result.push({
                month: monthNames[date.getMonth()],
                revenue: Math.round(data.revenue),
                profit: Math.round(data.profit),
                orders: data.orders,
            });
        }

        return result;
    } catch (error) {
        console.error('Failed to fetch monthly chart data:', error);
        return [];
    }
}
