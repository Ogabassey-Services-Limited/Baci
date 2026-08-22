import { format, subDays } from 'date-fns';

/** Builds a provider reporting window from browser-local calendar dates. */
export function buildDefaultAdsSyncWindow(end = new Date()): {
  endDate: string;
  startDate: string;
} {
  return {
    endDate: format(end, 'yyyy-MM-dd'),
    startDate: format(subDays(end, 30), 'yyyy-MM-dd'),
  };
}
