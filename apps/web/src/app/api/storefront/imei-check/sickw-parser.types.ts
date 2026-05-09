export interface ImeiCheckResult {
  imei: string;
  device: string;
  modelNumber: string;
  status: 'Clean' | 'Blacklisted' | 'Unknown';
  icloud: string;
  icloudLock: string;
  simLock: string;
  blacklistStatus: string;
  carrier: string;
  deviceImage: string;
  score: number;
  activationStatus?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchaseCountry?: string;
  warranty?: string;
  refurbished?: string;
  demoUnit?: string;
  deviceType: 'apple' | 'android' | 'other';
  verdict: string;
  verdictType: 'safe' | 'caution' | 'danger';
  rawResponse?: string;
}
