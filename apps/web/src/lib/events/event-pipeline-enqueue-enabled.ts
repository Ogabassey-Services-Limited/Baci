export function isEventPipelineEnqueueEnabled(): boolean {
  return process.env.EVENT_PIPELINE_ENQUEUE_ENABLED === 'true';
}
