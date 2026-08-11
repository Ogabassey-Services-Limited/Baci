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

export function isBuilderPreviewRenderEvent(event: Event): boolean {
  if (!('data' in event)) return false;
  const data = event.data;
  const parsed =
    typeof data === 'string'
      ? (() => {
          try {
            return JSON.parse(data) as unknown;
          } catch {
            return null;
          }
        })()
      : data;
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    'type' in parsed &&
    parsed.type === 'baci.builder-preview.render'
  );
}
