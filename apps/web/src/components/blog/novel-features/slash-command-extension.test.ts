import { describe, expect, it, vi } from 'vitest';

const { mockConfigure, mockRenderItems } = vi.hoisted(() => ({
  mockConfigure: vi.fn(),
  mockRenderItems: vi.fn(),
}));

vi.mock('novel', () => ({
  Command: { configure: mockConfigure },
  renderItems: mockRenderItems,
}));

import { createSlashCommand } from './slash-command-extension';

describe('createSlashCommand', () => {
  it('configures the slash extension with the supplied suggestions', () => {
    const suggestionItems = [{ title: 'Text' }];
    const configuredExtension = { name: 'slash-command' };
    mockConfigure.mockReturnValue(configuredExtension);

    expect(createSlashCommand(suggestionItems as never)).toBe(
      configuredExtension
    );
    expect(mockConfigure).toHaveBeenCalledWith({
      suggestion: {
        items: expect.any(Function),
        render: mockRenderItems,
      },
    });

    const configuration = mockConfigure.mock.calls[0]?.[0];
    expect(configuration.suggestion.items()).toBe(suggestionItems);
  });
});
