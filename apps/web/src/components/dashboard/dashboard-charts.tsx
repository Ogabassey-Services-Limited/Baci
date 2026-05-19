'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartConfig } from '@/components/ui/chart';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { formatPrice } from '@/lib/currency-utils';

interface ChartDataPoint {
  month: string;
  revenue: number;
  profit: number;
  orders: number;
}

interface DashboardChartsProps {
  data: ChartDataPoint[];
  config: ChartConfig;
  country?: string | null;
}

export function RevenueSparkline({ data, config }: DashboardChartsProps) {
  return (
    <ChartContainer config={config} className="h-full w-full min-h-[100px]">
      <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="hsl(var(--primary))"
              stopOpacity={0.3}
            />
            <stop
              offset="95%"
              stopColor="hsl(var(--primary))"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="hsl(var(--primary))"
          fillOpacity={1}
          fill="url(#revenueGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function RevenueBarChart({
  data,
  config,
  country,
}: DashboardChartsProps) {
  return (
    <ChartContainer config={config} className="h-full w-full">
      <BarChart data={data} barGap={2}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="rgba(255,255,255,0.1)"
        />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) =>
            formatPrice(value, country || null, {
              notation: 'compact',
              maximumFractionDigits: 1,
            })
          }
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
        />
        <ChartTooltip
          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
          content={
            <ChartTooltipContent
              indicator="dot"
              formatter={(value) => formatPrice(Number(value), country || null)}
            />
          }
        />
        <Legend
          verticalAlign="top"
          align="right"
          wrapperStyle={{ paddingBottom: 10 }}
          formatter={(value) => (
            <span
              style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            >
              {value}
            </span>
          )}
        />
        <Bar
          dataKey="revenue"
          fill="hsl(var(--primary))"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
          name="Revenue"
        />
        <Bar
          dataKey="profit"
          fill="hsl(142 76% 36%)"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
          name="Profit"
        />
      </BarChart>
    </ChartContainer>
  );
}
