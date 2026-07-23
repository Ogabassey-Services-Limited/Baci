export function isUnverifiedEventTelemetryEnabled(): boolean {
  return process.env.EVENT_PIPELINE_ALLOW_UNVERIFIED_TELEMETRY === 'true';
}
