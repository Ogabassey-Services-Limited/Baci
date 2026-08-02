export type MeasurementReceipt = Readonly<{
  providerReceiptSha256: string;
  payloadSha256: string;
  observedAt: string;
}>;
