export const eventPipelineAdminImporters = [
  'apps/web/src/app/api/orders/route.ts',
  'apps/web/src/app/api/payments/juicyway/webhook/route.ts',
  'apps/web/src/app/api/platform/events/platform-event-forwarding.ts',
  'apps/web/src/lib/events/record-platform-order-created-event.ts',
  'apps/web/src/lib/expo-push.ts',
  'apps/web/src/lib/insurance/notify-activate-protection.ts',
] as const;

export const eventPipelineLegacySdkImporters = [
  'apps/web/src/lib/events/event-ingress-capability.ts',
  'apps/web/src/lib/events/event-pipeline-test-client.ts',
  'vps-workers/jobs/supabase-retention-cleanup.mjs',
] as const;
