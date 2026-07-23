const MAX_DELIVERY_BATCH_SIZE = 25;

function getEventDeliveryClaimBatchSize(concurrency: number): number {
  return Math.min(MAX_DELIVERY_BATCH_SIZE, Math.max(1, concurrency) * 2);
}

export { getEventDeliveryClaimBatchSize };
