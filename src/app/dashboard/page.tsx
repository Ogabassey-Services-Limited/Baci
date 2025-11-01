
'use client';

import {
  Activity,
  CreditCard,
  DollarSign,
  Users,
  Copy,
  ExternalLink,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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

const chartData = [
  { month: 'January', desktop: 186, mobile: 80 },
  { month: 'February', desktop: 305, mobile: 200 },
  { month: 'March', desktop: 237, mobile: 120 },
  { month: 'April', desktop: 73, mobile: 190 },
  { month: 'May', desktop: 209, mobile: 130 },
  { month: 'June', desktop: 214, mobile: 140 },
];

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

export default function DashboardPage() {
  const { merchant } = useMerchant();
  const { toast } = useToast();
  
  const storeUrl = merchant?.businessName ? `${merchant.businessName.toLowerCase().replace(/\s+/g, '-')}.baci.store` : '';
  const fullStoreUrl = storeUrl ? `https://${storeUrl}` : '';

  const copyToClipboard = () => {
    if (fullStoreUrl) {
        navigator.clipboard.writeText(fullStoreUrl);
        toast({
        title: "Copied to clipboard!",
        description: "Your store URL is ready to be shared.",
        });
    }
  };

  const formatCurrency = (amount: number) => {
    const country = merchant?.country ? getCountryByCode(merchant.country) : undefined;
    const locale = country ? `en-${country.code}` : 'en-US';
    const currency = country ? country.currency : 'USD';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };
  
  const yAxisFormatter = (value: number) => {
      const country = merchant?.country ? getCountryByCode(merchant.country) : undefined;
      const currency = country ? country.currency : 'USD';
      const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        notation: 'compact'
      });
      return formatter.format(value).replace(/\D00$/, '');
  };


  return (
    <>
      {merchant && storeUrl && (
         <Card>
          <CardHeader>
            <CardTitle>Your Store is Live!</CardTitle>
            <CardDescription>Share your store link with your customers.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="flex items-center justify-between p-3 border rounded-lg bg-muted">
                <Link href={fullStoreUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-sm truncate hover:underline">
                    {storeUrl}
                </Link>
                <div className="flex items-center gap-2">
                     <Button variant="ghost" size="icon" onClick={copyToClipboard}>
                        <Copy className="w-4 h-4" />
                        <span className="sr-only">Copy URL</span>
                    </Button>
                    <Link href={fullStoreUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon">
                            <ExternalLink className="w-4 h-4" />
                            <span className="sr-only">Open in new tab</span>
                        </Button>
                    </Link>
                </div>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(45231.89)}</div>
            <p className="text-xs text-muted-foreground">
              +20.1% from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+2350</div>
            <p className="text-xs text-muted-foreground">
              +180.1% from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales</CardTitle>
            <CreditCard className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+12,234</div>
            <p className="text-xs text-muted-foreground">
              +19% from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Now</CardTitle>
            <Activity className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+573</div>
            <p className="text-xs text-muted-foreground">
              +201 since last hour
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
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
        <Card>
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
      </div>
    </>
  );
}
