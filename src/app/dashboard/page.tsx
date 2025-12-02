'use client';

import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  ArrowUp,
  Clock,
  CreditCard,
  DollarSign,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { BentoCard } from '@/components/ui/bento-card';
import { Button } from '@/components/ui/button';
import type { ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { useMerchant } from '@/hooks/use-merchant';
// import Link from 'next/link';
import { cn } from '@/lib/utils';

// Dynamically import chart wrapper components (correct pattern)
const RevenueSparkline = dynamic(
  () =>
    import('@/components/dashboard/dashboard-charts').then(
      (mod) => mod.RevenueSparkline
    ),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> }
);

const RevenueBarChart = dynamic(
  () =>
    import('@/components/dashboard/dashboard-charts').then(
      (mod) => mod.RevenueBarChart
    ),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> }
);

// --- Mock Data ---

const monthlyChartData = [
  { month: 'Jan', revenue: 18600, orders: 80 },
  { month: 'Feb', revenue: 30500, orders: 120 },
  { month: 'Mar', revenue: 23700, orders: 95 },
  { month: 'Apr', revenue: 7300, orders: 45 },
  { month: 'May', revenue: 20900, orders: 110 },
  { month: 'Jun', revenue: 21400, orders: 140 },
];

const summaryData = {
  revenue: { value: 45231.89, change: 20.1 },
  customers: { value: 2350, change: 180.1 },
  orders: { value: 12234, change: 19 },
  activeNow: { value: 573, change: 201 },
};

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--primary))',
  },
  orders: {
    label: 'Orders',
    color: 'hsl(var(--accent))',
  },
} satisfies ChartConfig;

const recentSales = [
  {
    id: '1',
    name: 'Olivia Martin',
    email: 'olivia.martin@email.com',
    amount: 1999.0,
    status: 'Completed',
  },
  {
    id: '2',
    name: 'Jackson Lee',
    email: 'jackson.lee@email.com',
    amount: 39.0,
    status: 'Processing',
  },
  {
    id: '3',
    name: 'Isabella Nguyen',
    email: 'isabella.nguyen@email.com',
    amount: 299.0,
    status: 'Completed',
  },
  {
    id: '4',
    name: 'William Kim',
    email: 'will@email.com',
    amount: 99.0,
    status: 'Failed',
  },
];

export default function DashboardPage() {
  const { merchant } = useMerchant();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // In a real app, we would fetch data here and handle errors
    // For now, since we're using mock data, we'll simulate a successful load
    // If this were a real fetch:
    /*
    fetchAnalytics()
      .catch(error => {
        console.error('Failed to load analytics:', error);
        toast({
          title: "Error loading dashboard",
          description: "Could not fetch latest analytics data. Showing cached data.",
          variant: "destructive"
        });
      });
    */
  }, []);

  if (!mounted) return null;

  return (
    <div className="space-y-6 p-6 pb-20">
      {/* Header Section */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent">
            Dashboard 🚀
          </h1>
          <p className="text-muted-foreground">
            Overview of your store's performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
            <Sparkles className="mr-2 h-4 w-4" />
            Ask AI Assistant
          </Button>
        </div>
      </div>

      {/* AI Insight Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <BentoCard
          className="bg-gradient-to-br from-primary/10 via-background to-accent/5 border-primary/20"
          noPadding
        >
          <div className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-8 w-8" />
            </div>
            <div className="space-y-2 flex-1">
              <h3 className="text-xl font-semibold">
                Good morning, {merchant?.business_name || 'Merchant'}! 🚀
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Your store is performing exceptionally well today. Revenue is up{' '}
                <span className="text-green-500 font-medium">+20.1%</span>{' '}
                compared to last week, driven by a surge in mobile traffic.
                Consider restocking your top-selling items to maintain momentum.
              </p>
            </div>
            <Button variant="outline" className="shrink-0">
              View Insights
            </Button>
          </div>
        </BentoCard>
      </motion.div>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="col-span-1"
        >
          <BentoCard title="Total Revenue" icon={DollarSign}>
            <div className="mt-2 space-y-1">
              <div className="text-3xl font-bold tracking-tight">
                ${summaryData.revenue.value.toLocaleString()}
              </div>
              <div className="flex items-center text-xs text-green-500 font-medium">
                <ArrowUp className="mr-1 h-3 w-3" />
                {summaryData.revenue.change}% from last month
              </div>
            </div>
            <div className="h-[60px] mt-4 -mx-2">
              <RevenueSparkline data={monthlyChartData} config={chartConfig} />
            </div>
          </BentoCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="col-span-1"
        >
          <BentoCard title="Active Orders" icon={ShoppingBag}>
            <div className="mt-2 space-y-1">
              <div className="text-3xl font-bold tracking-tight">
                +{summaryData.orders.value.toLocaleString()}
              </div>
              <div className="flex items-center text-xs text-green-500 font-medium">
                <ArrowUp className="mr-1 h-3 w-3" />
                {summaryData.orders.change}% from last month
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-[65%]" />
              </div>
              <span className="text-xs text-muted-foreground">
                65% fulfilled
              </span>
            </div>
          </BentoCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="col-span-1"
        >
          <BentoCard title="Customers" icon={Users}>
            <div className="mt-2 space-y-1">
              <div className="text-3xl font-bold tracking-tight">
                +{summaryData.customers.value.toLocaleString()}
              </div>
              <div className="flex items-center text-xs text-green-500 font-medium">
                <ArrowUp className="mr-1 h-3 w-3" />
                {summaryData.customers.change}% from last month
              </div>
            </div>
            <div className="mt-4 flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium"
                >
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
              <div className="h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                +4k
              </div>
            </div>
          </BentoCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="col-span-1"
        >
          <BentoCard title="Active Now" icon={Activity}>
            <div className="mt-2 space-y-1">
              <div className="text-3xl font-bold tracking-tight">
                {summaryData.activeNow.value}
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                <Clock className="mr-1 h-3 w-3" />
                Real-time updates
              </div>
            </div>
            <div className="h-[60px] mt-4 flex items-end justify-between gap-1">
              {[40, 25, 60, 30, 70, 45, 20, 55, 35, 65].map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{
                    duration: 1,
                    repeat: Number.POSITIVE_INFINITY,
                    repeatType: 'reverse',
                    delay: i * 0.1,
                  }}
                  className="w-full bg-primary/20 rounded-t-sm"
                />
              ))}
            </div>
          </BentoCard>
        </motion.div>

        {/* Big Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="col-span-1 md:col-span-2 lg:col-span-3 row-span-2"
        >
          <BentoCard
            title="Revenue Overview"
            icon={TrendingUp}
            className="h-full min-h-[400px]"
          >
            <div className="h-full w-full pt-4">
              <RevenueBarChart data={monthlyChartData} config={chartConfig} />
            </div>
          </BentoCard>
        </motion.div>

        {/* Recent Sales List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="col-span-1 md:col-span-2 lg:col-span-1 row-span-2"
        >
          <BentoCard title="Recent Sales" icon={CreditCard} className="h-full">
            <div className="space-y-4 mt-2">
              {recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                      {sale.name.charAt(0)}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium leading-none">
                        {sale.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sale.email}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">+${sale.amount}</p>
                    <p
                      className={cn(
                        'text-[10px] font-medium',
                        sale.status === 'Completed'
                          ? 'text-green-500'
                          : sale.status === 'Processing'
                            ? 'text-blue-500'
                            : 'text-red-500'
                      )}
                    >
                      {sale.status}
                    </p>
                  </div>
                </div>
              ))}
              <Button
                variant="ghost"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                View All Transactions <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </BentoCard>
        </motion.div>
      </div>
    </div>
  );
}
