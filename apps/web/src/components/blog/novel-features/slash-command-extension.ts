import { Command, renderItems } from 'novel';
import type { createSuggestionItems } from './slash-command';

export function createSlashCommand(
  suggestionItems: ReturnType<typeof createSuggestionItems>
) {
  return Command.configure({
    suggestion: {
      items: () => suggestionItems,
      render: renderItems,
    },
  });
}
