export function stripOrderNumberPrefix(
  orderNumber: string | null | undefined
): string {
  return orderNumber?.replace(/^#/, '').trim() || '';
}
