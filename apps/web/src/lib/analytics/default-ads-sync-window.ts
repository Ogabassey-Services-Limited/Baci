import { format, subDays } from 'date-fns';

export interface AdsSyncWindow {
  endDate: string;
  startDate: string;
}

/** Formats the selected browser-local analytics dates for provider sync. */
export function buildAdsSyncWindow(start: Date, end: Date): AdsSyncWindow {
  return {
    endDate: format(end, 'yyyy-MM-dd'),
    startDate: format(start, 'yyyy-MM-dd'),
  };
}

/** Builds a provider reporting window from browser-local calendar dates. */
export function buildDefaultAdsSyncWindow(end = new Date()): AdsSyncWindow {
  return buildAdsSyncWindow(subDays(end, 30), end);
}
