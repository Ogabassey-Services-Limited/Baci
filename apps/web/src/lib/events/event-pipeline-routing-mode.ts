export type EventPipelineRoutingMode = 'active' | 'disabled' | 'shadow';

export function getEventPipelineRoutingMode(): EventPipelineRoutingMode {
  const value = process.env.EVENT_PIPELINE_ROUTING_MODE;
  if (value === 'active' || value === 'shadow') return value;
  return 'disabled';
}
