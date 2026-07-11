/**
 * Formats a repair booking's `createdAt`/`preferredDate` ISO timestamp for
 * display. Mirrors `formatOrderDetailsDate`
 * (`apps/mobile-admin/components/orders/order-details.formatters.ts`).
 */
export function formatRepairBookingDate(dateString: string | null): string {
  if (!dateString) {
    return '-';
  }

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return parsed.toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
