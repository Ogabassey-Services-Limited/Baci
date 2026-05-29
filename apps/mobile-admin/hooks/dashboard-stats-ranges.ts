import type { TimePeriod } from './dashboard-stats.types';

export function getDateRange(period: TimePeriod): {
  start: string | null;
  end: string;
} {
  const now = new Date();
  const end = now.toISOString();

  switch (period) {
    case 'today': {
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      return { start: startOfDay.toISOString(), end };
    }
    case 'week': {
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start: startOfWeek.toISOString(), end };
    }
    case 'month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfMonth.toISOString(), end };
    }
    case 'all':
      return { start: null, end };
  }
}

export function getPreviousPeriodDateRange(
  period: TimePeriod
): { start: string | null; end: string } | null {
  const now = new Date();

  switch (period) {
    case 'today': {
      const yesterdayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1
      );
      const yesterdayEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      return {
        end: yesterdayEnd.toISOString(),
        start: yesterdayStart.toISOString(),
      };
    }
    case 'week': {
      const prevWeekEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const prevWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      return {
        end: prevWeekEnd.toISOString(),
        start: prevWeekStart.toISOString(),
      };
    }
    case 'month': {
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        end: prevMonthEnd.toISOString(),
        start: prevMonthStart.toISOString(),
      };
    }
    case 'all':
      return null;
  }
}
