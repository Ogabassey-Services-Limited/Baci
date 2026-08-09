import {
  type BuilderPreviewMessage,
  builderPreviewMessageSchema,
} from '@baci/shared/contracts';

export function parseBuilderPreviewEvent(
  event: MessageEvent<unknown>
): BuilderPreviewMessage | null {
  const result = builderPreviewMessageSchema.safeParse(event.data);
  return result.success ? result.data : null;
}
