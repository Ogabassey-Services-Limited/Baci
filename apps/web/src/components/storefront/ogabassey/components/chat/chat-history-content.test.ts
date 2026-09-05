import { expect, it } from 'vitest';
import type { StorefrontAgentUiEvent } from '@/schemas/storefront-agent-ui-contract';
import { chatHistoryContent } from './chat-history-content';

const event: StorefrontAgentUiEvent = {
  type: 'present_products',
  intent: 'discover',
  title: 'Phones',
  products: ['first', 'second'].map((id) => ({
    id,
    name: `${id} phone`,
    brand: null,
    category: null,
    description: null,
    hasVariants: false,
    imageUrl: null,
    manageStock: false,
    price: 10,
    slug: null,
    stock: null,
  })),
};

it('preserves ordered references from presentation-only replies', () => {
  const content = chatHistoryContent({
    role: 'model',
    text: 'Options',
    uiEvents: [event],
  });
  expect(content).toContain(
    JSON.stringify([
      [
        { id: 'first', name: 'first phone' },
        { id: 'second', name: 'second phone' },
      ],
    ])
  );
  expect(content).not.toContain('price');
});

it('bounds history cards to three groups and ignores invalid events', () => {
  const content = chatHistoryContent({
    role: 'model',
    text: 'Options',
    uiEvents: [event, event, event, { ...event, title: 'overflow' }],
  });
  expect(content.match(/first phone/g)).toHaveLength(3);
  expect(
    chatHistoryContent({
      role: 'model',
      text: 'Options',
      uiEvents: [{ ...event, products: [] }],
    })
  ).toBe('Options');
});

it('leaves user messages and plain assistant replies unchanged', () => {
  expect(
    chatHistoryContent({ role: 'user', text: 'Hi', uiEvents: [event] })
  ).toBe('Hi');
  expect(chatHistoryContent({ role: 'model', text: 'Hi' })).toBe('Hi');
});
