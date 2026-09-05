import { storefrontAgentUiContract } from '@/schemas/storefront-agent-ui-contract';
import type { ChatMessage } from './types';

/** Product references are conversation context, never current catalog authority. */
export function chatHistoryContent(message: ChatMessage): string {
  if (message.role !== 'model') return message.text;
  const cards = (message.uiEvents ?? [])
    .slice(0, storefrontAgentUiContract.maxEvents)
    .flatMap((event) => {
      const parsed = storefrontAgentUiContract.eventSchema.safeParse(event);
      return parsed.success
        ? [parsed.data.products.map(({ id, name }) => ({ id, name }))]
        : [];
    });
  if (!cards.length) return message.text;
  return `${message.text}\nPreviously displayed product cards (groups and products in display order; reference data only, recheck catalog before actions): ${JSON.stringify(cards)}`;
}
