import { supabase } from '@/lib/supabase';
import { ALL_BRANCH_SCOPE, type BranchScope } from '@/schemas/branch';
import type { RevenueDataPoint, TimePeriod } from './dashboard-stats.types';

interface RevenueChartBucket {
  end_at: string;
  label: string;
  ordinal: number;
  start_at: string;
}

type RevenueChartRpcPoint = {
  label?: unknown;
  value?: unknown;
};

export async function fetchRevenueChart(
  merchantId: string,
  period: TimePeriod,
  scope: BranchScope = ALL_BRANCH_SCOPE
): Promise<RevenueDataPoint[]> {
  const buckets = buildRevenueChartBuckets(period);
  const { data, error } = await supabase.rpc('get_mobile_admin_revenue_chart', {
    p_branch_id: scope.type === 'branch' ? scope.branchId : null,
    p_buckets: buckets,
    p_merchant_id: merchantId,
  });

  if (error) {
    throw new Error(`fetchRevenueChart rpc failed: ${error.message}`);
  }

  if (!Array.isArray(data)) {
    return buckets.map((bucket) => ({
      id: getRevenueChartPointId(bucket),
      label: bucket.label,
      value: 0,
    }));
  }

  return data.map((point: RevenueChartRpcPoint, index) => {
    const bucket = buckets[index];
    return {
      id: bucket ? getRevenueChartPointId(bucket) : `${period}:${index}`,
      label: typeof point.label === 'string' ? point.label : '',
      value: Number(point.value ?? 0),
    };
  });
}

export function buildRevenueChartBuckets(
  period: TimePeriod
): RevenueChartBucket[] {
  const now = new Date();

  if (period === 'today') {
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    return [
      { label: '12am', start: 0, end: 4 },
      { label: '4am', start: 4, end: 8 },
      { label: '8am', start: 8, end: 12 },
      { label: '12pm', start: 12, end: 16 },
      { label: '4pm', start: 16, end: 20 },
      { label: '8pm', start: 20, end: 24 },
    ].map((slot, ordinal) => {
      const start = new Date(startOfDay);
      start.setHours(slot.start, 0, 0, 0);
      const end = new Date(startOfDay);
      end.setHours(slot.end, 0, 0, 0);
      return toRevenueChartBucket(slot.label, start, end, ordinal);
    });
  }

  if (period === 'week') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return Array.from({ length: 7 }, (_, ordinal) => {
      const start = new Date(now);
      start.setDate(start.getDate() - (6 - ordinal));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return toRevenueChartBucket(days[start.getDay()], start, end, ordinal);
    });
  }

  if (period === 'month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const buckets: RevenueChartBucket[] = [];
    let cursor = new Date(startOfMonth);
    while (cursor < now && buckets.length < 5) {
      const start = new Date(cursor);
      const end = new Date(start);
      const daysUntilNextWeek = start.getDay() === 0 ? 7 : 7 - start.getDay();
      end.setDate(end.getDate() + daysUntilNextWeek);
      if (end > now) {
        end.setTime(now.getTime());
      }
      buckets.push(
        toRevenueChartBucket(
          `Wk ${buckets.length + 1}`,
          start,
          end,
          buckets.length
        )
      );
      cursor = new Date(end);
    }
    return buckets;
  }

  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return Array.from({ length: 6 }, (_, ordinal) => {
    const start = new Date(
      now.getFullYear(),
      now.getMonth() - (5 - ordinal),
      1
    );
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    if (end > now) {
      end.setTime(now.getTime());
    }
    return toRevenueChartBucket(months[start.getMonth()], start, end, ordinal);
  });
}

function toRevenueChartBucket(
  label: string,
  start: Date,
  end: Date,
  ordinal: number
): RevenueChartBucket {
  return {
    end_at: end.toISOString(),
    label,
    ordinal,
    start_at: start.toISOString(),
  };
}

function getRevenueChartPointId(bucket: RevenueChartBucket): string {
  return `${bucket.start_at}:${bucket.end_at}`;
}
