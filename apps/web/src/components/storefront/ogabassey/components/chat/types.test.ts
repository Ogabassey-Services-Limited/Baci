import { describe, expect, it } from 'vitest';
import {
  PROACTIVE_MESSAGES,
  resolveSuggestionNavigationPath,
  SUGGESTIONS,
} from './types';
import type { ChatMessage, SantaCartAction } from './types';

describe('types - SUGGESTIONS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(SUGGESTIONS)).toBe(true);
    expect(SUGGESTIONS.length).toBeGreaterThan(0);
  });

  it('each suggestion has a label string', () => {
    for (const suggestion of SUGGESTIONS) {
      expect(typeof suggestion.label).toBe('string');
      expect(suggestion.label.length).toBeGreaterThan(0);
    }
  });

  it('each suggestion has an icon property', () => {
    for (const suggestion of SUGGESTIONS) {
      expect(suggestion.icon).toBeDefined();
    }
  });

  it('contains expected labels', () => {
    const labels = SUGGESTIONS.map((s) => s.label);
    expect(labels).toContain('Track my order');
    expect(labels).toContain('Contact support');
  });

  it('includes a repair-quote deep-link chip pointing at /repairs', () => {
    const repairChip = SUGGESTIONS.find((s) => s.href === '/repairs');
    expect(repairChip).toBeDefined();
    expect(repairChip?.label).toBe('Repair quote');
  });
});

describe('types - resolveSuggestionNavigationPath', () => {
  it('returns null for message-sending chips without an href', () => {
    expect(
      resolveSuggestionNavigationPath({ href: undefined }, '/ogabassey')
    ).toBeNull();
  });

  it('joins the href with a path-based storefront base path', () => {
    expect(
      resolveSuggestionNavigationPath({ href: '/repairs' }, '/ogabassey')
    ).toBe('/ogabassey/repairs');
  });

  it('resolves against the root when served on a custom domain', () => {
    expect(resolveSuggestionNavigationPath({ href: '/repairs' }, '')).toBe(
      '/repairs'
    );
  });
});

describe('types - PROACTIVE_MESSAGES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(PROACTIVE_MESSAGES)).toBe(true);
    expect(PROACTIVE_MESSAGES.length).toBeGreaterThan(0);
  });

  it('each message is a non-empty string', () => {
    for (const msg of PROACTIVE_MESSAGES) {
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    }
  });

  it('contains at least 5 messages', () => {
    expect(PROACTIVE_MESSAGES.length).toBeGreaterThanOrEqual(5);
  });
});

describe('types - ChatMessage type structure', () => {
  it('accepts a user message with required fields', () => {
    const userMessage: ChatMessage = {
      role: 'user',
      text: 'Hello there!',
    };
    expect(userMessage.role).toBe('user');
    expect(userMessage.text).toBe('Hello there!');
    expect(userMessage.santaAction).toBeUndefined();
  });

  it('accepts a model message with required fields', () => {
    const modelMessage: ChatMessage = {
      role: 'model',
      text: 'How can I help you today?',
    };
    expect(modelMessage.role).toBe('model');
    expect(modelMessage.text).toBe('How can I help you today?');
  });

  it('accepts a model message with an optional santaAction', () => {
    const santaAction: SantaCartAction = {
      productName: 'Samsung Galaxy S24',
      price: 450000,
      added: false,
    };
    const messageWithAction: ChatMessage = {
      role: 'model',
      text: 'I found this product for you!',
      santaAction,
    };
    expect(messageWithAction.santaAction).toBeDefined();
    expect(messageWithAction.santaAction?.productName).toBe('Samsung Galaxy S24');
    expect(messageWithAction.santaAction?.price).toBe(450000);
    expect(messageWithAction.santaAction?.added).toBe(false);
  });

  it('accepts a model message with multiple Santa actions', () => {
    const santaActions: SantaCartAction[] = [
      { productName: 'Samsung Galaxy S24', price: 450000, added: false },
      { productName: 'iPhone 15', price: 600000, added: false },
    ];
    const messageWithActions: ChatMessage = {
      role: 'model',
      text: 'I found these products for you!',
      santaActions,
    };
    expect(messageWithActions.santaActions).toHaveLength(2);
    expect(messageWithActions.santaActions?.[1]?.productName).toBe('iPhone 15');
  });

  it('santaAction can reflect added state', () => {
    const addedAction: SantaCartAction = {
      productName: 'iPhone 15',
      price: 600000,
      added: true,
    };
    expect(addedAction.added).toBe(true);
  });
});
