import { applyOrderBranchScope } from '@/lib/branch-scope-query';
import { supabase } from '@/lib/supabase';
import { ALL_BRANCH_SCOPE, type BranchScope } from '@/schemas/branch';
import type { RevenueDataPoint, TimePeriod } from './dashboard-stats.types';

export async function fetchRevenueChart(
  merchantId: string,
  period: TimePeriod,
  scope: BranchScope = ALL_BRANCH_SCOPE
): Promise<RevenueDataPoint[]> {
  const now = new Date();
  let rangeStart: Date;
  const rangeEnd: Date = now;

  if (period === 'today') {
    rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === 'week') {
    rangeStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    rangeStart = new Date(
      rangeStart.getFullYear(),
      rangeStart.getMonth(),
      rangeStart.getDate()
    );
  } else if (period === 'month') {
    rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    rangeStart = new Date(
      sixMonthsAgo.getFullYear(),
      sixMonthsAgo.getMonth(),
      1
    );
  }

  let ordersQuery = supabase
    .from('orders')
    .select('total, created_at')
    .eq('merchant_id', merchantId)
    .gte('created_at', rangeStart.toISOString())
    .lte('created_at', rangeEnd.toISOString());
  ordersQuery = applyOrderBranchScope(ordersQuery, scope);

  const { data: orders, error } = await ordersQuery;
  if (error) {
    throw new Error(`fetchRevenueChart orders query failed: ${error.message}`);
  }

  if (period === 'today') {
    const slots = [
      { label: '12am', start: 0, end: 4 },
      { label: '4am', start: 4, end: 8 },
      { label: '8am', start: 8, end: 12 },
      { label: '12pm', start: 12, end: 16 },
      { label: '4pm', start: 16, end: 20 },
      { label: '8pm', start: 20, end: 24 },
    ];
    const buckets = slots.map((slot) => ({ label: slot.label, value: 0 }));
    orders?.forEach((order) => {
      const hour = new Date(order.created_at).getHours();
      const slotIndex = slots.findIndex((s) => hour >= s.start && hour < s.end);
      if (slotIndex >= 0) buckets[slotIndex].value += order.total || 0;
    });
    return buckets;
  }

  if (period === 'week') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayBuckets: { label: string; date: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      dayBuckets.push({ date: dateStr, label: days[date.getDay()], value: 0 });
    }
    orders?.forEach((order) => {
      const d = new Date(order.created_at);
      const dateStr = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const bucket = dayBuckets.find((b) => b.date === dateStr);
      if (bucket) bucket.value += order.total || 0;
    });
    return dayBuckets.map(({ label, value }) => ({ label, value }));
  }

  if (period === 'month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const weeksInMonth = Math.ceil((now.getDate() + startOfMonth.getDay()) / 7);
    const weekCount = Math.min(weeksInMonth, 5);
    const weekBuckets: {
      label: string;
      start: Date;
      end: Date;
      value: number;
    }[] = [];
    for (let week = 0; week < weekCount; week++) {
      const weekStart = new Date(startOfMonth);
      weekStart.setDate(weekStart.getDate() + week * 7 - startOfMonth.getDay());
      if (weekStart < startOfMonth) weekStart.setTime(startOfMonth.getTime());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      if (weekEnd > now) weekEnd.setTime(now.getTime());
      weekBuckets.push({
        end: weekEnd,
        label: `Wk ${week + 1}`,
        start: weekStart,
        value: 0,
      });
    }
    orders?.forEach((order) => {
      const orderDate = new Date(order.created_at);
      for (const bucket of weekBuckets) {
        if (orderDate >= bucket.start && orderDate < bucket.end) {
          bucket.value += order.total || 0;
          break;
        }
      }
    });
    return weekBuckets.map(({ label, value }) => ({ label, value }));
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
  const monthBuckets: {
    label: string;
    year: number;
    month: number;
    value: number;
  }[] = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    monthBuckets.push({
      label: months[date.getMonth()],
      month: date.getMonth(),
      value: 0,
      year: date.getFullYear(),
    });
  }

  orders?.forEach((order) => {
    const d = new Date(order.created_at);
    const bucket = monthBuckets.find(
      (b) => b.year === d.getFullYear() && b.month === d.getMonth()
    );
    if (bucket) bucket.value += order.total || 0;
  });

  return monthBuckets.map(({ label, value }) => ({ label, value }));
}
