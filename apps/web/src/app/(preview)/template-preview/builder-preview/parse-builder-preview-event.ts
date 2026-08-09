import {
  type BuilderPreviewMessage,
  builderPreviewMessageSchema,
} from '@baci/shared/contracts';

export function parseBuilderPreviewEvent(
  event: Event
): BuilderPreviewMessage | null {
  if (!('data' in event)) return null;
  const data =
    typeof event.data === 'string'
      ? (() => {
          try {
            const parsed: unknown = JSON.parse(event.data);
            return parsed;
          } catch {
            return null;
          }
        })()
      : event.data;
  const result = builderPreviewMessageSchema.safeParse(data);
  return result.success ? result.data : null;
}
