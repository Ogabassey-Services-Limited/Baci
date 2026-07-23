type DomainEventMetadata = {
  environment: string;
  request_id?: string;
};

export function createDomainEventMetadata(
  requestId?: string
): DomainEventMetadata {
  const normalizedRequestId = requestId?.trim();
  const safeRequestId =
    normalizedRequestId &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(normalizedRequestId)
      ? normalizedRequestId
      : undefined;
  return {
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    ...(safeRequestId ? { request_id: safeRequestId } : {}),
  };
}
