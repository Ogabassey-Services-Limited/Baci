export function buildPaidAgenticDvaMetadata({
  accountNumber,
  gatewayReference,
  metadata,
}: {
  accountNumber: string;
  gatewayReference: string;
  metadata: unknown;
}) {
  const root = toRecord(metadata);
  const agentic = toRecord(root.agentic);

  return {
    ...root,
    agentic: {
      ...agentic,
      payment_state: 'paid',
      payment_webhook: {
        account_number: accountNumber,
        gateway: 'paystack',
        gateway_reference: gatewayReference,
        processed_at: new Date().toISOString(),
      },
    },
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
