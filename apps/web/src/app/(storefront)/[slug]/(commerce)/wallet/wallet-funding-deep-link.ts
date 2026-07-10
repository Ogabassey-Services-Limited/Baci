export function isWalletFundingDeepLink(
  value: string | string[] | undefined
): boolean {
  return Array.isArray(value) ? value.includes('1') : value === '1';
}
