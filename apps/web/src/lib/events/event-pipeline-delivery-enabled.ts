export function isEventPipelineDeliveryEnabled(): boolean {
  return process.env.EVENT_PIPELINE_DELIVERY_ENABLED === 'true';
}
