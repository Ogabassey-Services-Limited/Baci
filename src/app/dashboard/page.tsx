
'use client';

import {
  Activity,
  CreditCard,
  DollarSign,
  Users,
  Copy,
  ExternalLink,
  PlusCircle,
  Wrench,
  FlaskConical,
  RefreshCw,
  Loader2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import type { ChartConfig } from '@/components/ui/chart';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useMerchant } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { getCountryByCode } from '@/lib/countries';
import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// --- Mock Data ---

const monthlyChartData = [
  { month: 'January', desktop: 18600, mobile: 8000 },
  { month: 'February', desktop: 30500, mobile: 20000 },
  { month: 'March', desktop: 23700, mobile: 12000 },
  { month: 'April', desktop: 7300, mobile: 19000 },
  { month: 'May', desktop: 20900, mobile: 13000 },
  { month: 'June', desktop: 21400, mobile: 14000 },
];

const weeklyChartData = [
    { day: 'Sun', desktop: 2200, mobile: 1100 },
    { day: 'Mon', desktop: 3100, mobile: 1900 },
    { day: 'Tue', desktop: 2500, mobile: 1300 },
    { day: 'Wed', desktop: 4200, mobile: 2100 },
    { day: 'Thu', desktop: 1800, mobile: 900 },
    { day: 'Fri', desktop: 3800, mobile: 2400 },
    { day: 'Sat', desktop: 5100, mobile: 3200 },
];


const summaryData = {
  monthly: {
    revenue: { value: 45231.89, change: 20.1 },
    customers: { value: 2350, change: 180.1 },
    sales: { value: 12234, change: 19 },
    activeNow: { value: 573, change: 201 },
  },
  weekly: {
    revenue: { value: 11489.21, change: -5.2 },
    customers: { value: 412, change: 12.3 },
    sales: { value: 2891, change: -2.1 },
    activeNow: { value: 573, change: 201 }, // Active now doesn't change with filter
  },
};

const chartConfig = {
  desktop: {
    label: 'Desktop',
    color: 'hsl(var(--primary))',
  },
  mobile: {
    label: 'Mobile',
    color: 'hsl(var(--accent))',
  },
} satisfies ChartConfig;

const recentSales = [
    { id: 'p1', name: 'Olivia Martin', email: 'olivia.martin@email.com', amount: 1999.00, avatar: 'avatar-1' },
    { id: 'p2', name: 'Jackson Lee', email: 'jackson.lee@email.com', amount: 39.00, avatar: 'avatar-2' },
    { id: 'p3', name: 'Isabella Nguyen', email: 'isabella.nguyen@email.com', amount: 299.00, avatar: 'avatar-3' },
    { id: 'p4', name: 'William Kim', email: 'will@email.com', amount: 99.00, avatar: 'avatar-4' },
    { id: 'p5', name: 'Sofia Davis', email: 'sofia.davis@email.com', amount: 39.00, avatar: 'avatar-5' },
];

// --- Helper Component ---

function PercentageChange({ value, timeFrame }: { value: number; timeFrame: 'weekly' | 'monthly' }) {
    const isPositive = value >= 0;
    const Icon = isPositive ? ArrowUp : ArrowDown;
    return (
        <p className={cn("text-xs flex items-center", isPositive ? "text-green-600" : "text-red-600")}>
            <Icon className="h-3 w-3 mr-1" />
            {isPositive ? '+' : ''}{value.toFixed(1)}% from last {timeFrame === 'weekly' ? 'week' : 'month'}
        </p>
    );
}

// --- Main Component ---

export default function DashboardPage() {
  const { merchant, loading: merchantLoading } = useMerchant();
  const { toast } = useToast();
  const router = useRouter();
  const [timeFrame, setTimeFrame] = useState<'monthly' | 'weekly'>('monthly');

  const currentSummary = summaryData[timeFrame];
  const currentChartData = timeFrame === 'monthly' ? monthlyChartData : weeklyChartData;
  
  const getStoreUrl = () => {
    if (!merchant?.business_name) return { displayUrl: '', fullUrl: '' };
    const slug = merchant.business_name.toLowerCase().replace(/\s+/g, '-');
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'baci.store';
    const isLocal = typeof window !== 'undefined' && window.location.hostname.includes('localhost');
    
    if (isLocal) {
        return {
            displayUrl: `${slug}.localhost:3000`,
            fullUrl: `http://${slug}.localhost:3000`
        };
    }
    return {
        displayUrl: `${slug}.${rootDomain}`,
        fullUrl: `https://${slug}.${rootDomain}`
    };
  };

  const { displayUrl, fullUrl } = getStoreUrl();

  const copyToClipboard = () => {
    if (fullUrl) {
        navigator.clipboard.writeText(fullUrl);
        toast({
        title: "Copied to clipboard! 📋",
        description: "Your store URL is ready to be shared.",
        });
    }
  };

  const handleReset = () => {
    // This function will need to be updated to clear Supabase data if needed
    // For now, it will clear local session and redirect
    toast({
        title: "Reset Not Implemented",
        description: "This functionality will be updated for Supabase.",
    });
    // router.push('/onboarding');
  };

  const formatCurrency = (amount: number) => {
    const country = merchant?.country ? getCountryByCode(merchant.country) : undefined;
    const locale = country ? `en-${country.code}` : 'en-US';
    const currency = country ? country.currency : 'USD';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      currencyDisplay: 'symbol',
    }).format(amount);
  };
  
  const yAxisFormatter = (value: number) => {
      const country = merchant?.country ? getCountryByCode(merchant.country) : undefined;
      const currency = country ? country.currency : 'USD';
      const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        notation: 'compact',
        currencyDisplay: 'symbol',
      });
      return formatter.format(value).replace(/\D00$/, '');
  };

  const setupTasks = [
    {
      icon: PlusCircle,
      title: 'Add your first product',
      description: 'List items to start selling.',
      href: '/dashboard/products/add',
      buttonText: 'Add Product',
    },
    {
      icon: Wrench,
      title: 'Customize your store',
      description: 'Choose colors and a layout that matches your brand.',
      href: '/dashboard/settings',
      buttonText: 'Customize',
    },
    {
      icon: CreditCard,
      title: 'Set up payments',
      description: 'Connect a payment provider to start accepting money.',
      href: '/dashboard/settings',
      buttonText: 'Set Up',
    },
    {
      icon: FlaskConical,
      title: 'Run a test order',
      description: 'Make sure your checkout process is smooth for customers.',
      href: fullUrl || '/',
      buttonText: 'Visit Store',
    },
  ];

  if (merchantLoading) {
    return (
        <div className="flex flex-1 items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Welcome, {merchant?.business_name || 'Merchant'}! 👋</h1>
         {merchant && displayUrl && (
            <div className="flex items-center justify-between p-2 border rounded-lg bg-muted text-sm">
                <Link href={fullUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-sm truncate hover:underline px-2">
                    {displayUrl}
                </Link>
                <div className="flex items-center gap-1">
                     <Button variant="ghost" size="icon" onClick={copyToClipboard} className="h-8 w-8">
                        <Copy className="w-4 h-4" />
                        <span className="sr-only">Copy URL</span>
                    </Button>
                    <Link href={fullUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ExternalLink className="w-4 h-4" />
                            <span className="sr-only">Open in new tab</span>
                        </Button>
                    </Link>
                </div>
            </div>
        )}
      </div>

       <Card className="mb-8 border border-blue-200">
        <CardHeader>
          <CardTitle>Setup Checklist ✅</CardTitle>
          <CardDescription>Follow these steps to get your store ready for customers.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {setupTasks.map((task) => (
              <div key={task.title} className="flex items-center gap-4 p-4 rounded-lg border border-blue-200 bg-background">
                <task.icon className="w-8 h-8 text-primary" />
                <div className="flex-1">
                  <p className="font-semibold">{task.title}</p>
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                </div>
                <Link href={task.href} target={task.href.startsWith('http') ? '_blank' : '_self'}>
                  <Button variant="outline" className="border-primary text-primary hover:bg-primary/10 hover:text-primary">{task.buttonText}</Button>
                </Link>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      <div className="flex items-center mb-4">
        <Tabs value={timeFrame} onValueChange={(value) => setTimeFrame(value as 'monthly' | 'weekly')}>
            <TabsList>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
            </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card className="border border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue 💰</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(currentSummary.revenue.value)}</div>
            <PercentageChange value={currentSummary.revenue.change} timeFrame={timeFrame} />
          </CardContent>
        </Card>
        <Card className="border border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers 👥</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{currentSummary.customers.value}</div>
            <PercentageChange value={currentSummary.customers.change} timeFrame={timeFrame} />
          </CardContent>
        </Card>
        <Card className="border border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales 📈</CardTitle>
            <CreditCard className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{currentSummary.sales.value}</div>
            <PercentageChange value={currentSummary.sales.change} timeFrame={timeFrame} />
          </CardContent>
        </Card>
        <Card className="border border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Now 🟢</CardTitle>
            <Activity className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{currentSummary.activeNow.value}</div>
            <p className="text-xs text-muted-foreground">
              +{currentSummary.activeNow.change} since last hour
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3 mt-8">
        <Card className="xl:col-span-2 border border-blue-200">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
             <CardDescription>
                A summary of sales activity for this {timeFrame === 'weekly' ? 'week' : 'month'}.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart accessibilityLayer data={currentChartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey={timeFrame === 'monthly' ? "month" : "day"}
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => value.slice(0, 3)}
                />
                 <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tickFormatter={yAxisFormatter}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" />}
                />
                <Bar
                  dataKey="desktop"
                  fill="var(--color-desktop)"
                  radius={4}
                />
                <Bar
                  dataKey="mobile"
                  fill="var(--color-mobile)"
                  radius={4}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="border border-blue-200">
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
            <CardDescription>
              You made 265 sales this month.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSales.map((sale) => {
                 const avatar = PlaceHolderImages.find(img => img.id === sale.avatar);
                 return (
                    <Link href={`/product/${sale.id}`} key={sale.id} className="flex items-center hover:bg-muted/50 p-2 rounded-lg -m-2" target="_blank">
                        <Avatar className="h-9 w-9">
                        {avatar && (
                            <AvatarImage
                            src={avatar.imageUrl}
                            alt={avatar.description}
                            data-ai-hint={avatar.imageHint}
                            />
                        )}
                        <AvatarFallback>{sale.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="ml-4 space-y-1">
                        <p className="text-sm font-medium leading-none">
                            {sale.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {sale.email}
                        </p>
                        </div>
                        <div className="ml-auto font-medium">{formatCurrency(sale.amount)}</div>
                    </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
        <Card className="xl:col-span-3 border border-blue-200">
            <CardHeader>
                <CardTitle>Danger Zone ☢️</CardTitle>
                <CardDescription>These actions are irreversible. Please be certain.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button variant="destructive" onClick={handleReset}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reset and Start Over
                </Button>
            </CardContent>
        </Card>
      </div>
    </>
  );
}

    