export const BANK_NAMES: Record<string, string> = {
  '044': 'Access Bank',
  '023': 'Citibank Nigeria',
  '063': 'Diamond Bank',
  '050': 'Ecobank Nigeria',
  '070': 'Fidelity Bank',
  '011': 'First Bank of Nigeria',
  '214': 'First City Monument Bank',
  '058': 'Guaranty Trust Bank',
  '030': 'Heritage Bank',
  '301': 'Jaiz Bank',
  '082': 'Keystone Bank',
  '526': 'Parallex Bank',
  '076': 'Polaris Bank',
  '101': 'Providus Bank',
  '221': 'Stanbic IBTC Bank',
  '068': 'Standard Chartered Bank',
  '232': 'Sterling Bank',
  '100': 'Suntrust Bank',
  '032': 'Union Bank of Nigeria',
  '033': 'United Bank for Africa',
  '215': 'Unity Bank',
  '035': 'Wema Bank',
  '057': 'Zenith Bank',
  '999992': 'Opay',
  '50515': 'Moniepoint',
  '999991': 'PalmPay',
  '090110': 'VFD Microfinance Bank',
  '090267': 'Kuda Bank',
};

export function getBankNameFromCode(code: string | null): string | null {
  if (!code) return null;
  return BANK_NAMES[code] || null;
}
