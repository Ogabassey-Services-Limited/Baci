export function formatServicePrice(price: number): string {
  return `₦${price.toLocaleString('en-NG')}`;
}
