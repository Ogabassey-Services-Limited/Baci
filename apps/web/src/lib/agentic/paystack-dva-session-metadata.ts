export function isAgenticDvaSessionMetadata({
  accountNumber,
  metadata,
}: {
  accountNumber: string;
  metadata: unknown;
}): boolean {
  const agentic = toRecord(toRecord(metadata).agentic);
  const dvaAccount = toRecord(agentic.dva_account);

  return (
    agentic.payment_state === 'payment_pending' &&
    dvaAccount.account_number === accountNumber
  );
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
