const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidCalendarDate(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/**
 * Returns true if the YYYY-MM-DD date is strictly before today (UTC date-only).
 * Assumes `dateStr` has already passed `isValidCalendarDate`.
 */
export function isDateInPast(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  const inputUtc = Date.UTC(y, m - 1, d);
  const now = new Date();
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  return inputUtc < todayUtc;
}
