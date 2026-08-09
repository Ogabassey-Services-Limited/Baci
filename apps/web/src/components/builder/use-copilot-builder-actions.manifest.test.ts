import { useCopilotAction } from '@copilotkit/react-core';
import type { Data } from '@puckeditor/core';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCopilotBuilderActions } from './use-copilot-builder-actions';

vi.mock('@copilotkit/react-core', () => ({
  useCopilotAction: vi.fn(),
  useCopilotReadable: vi.fn(),
}));
vi.mock('./component-schema', () => ({
  COMPONENT_SCHEMA: { CodeEmbed: { type: 'CodeEmbed' } },
}));

describe('useCopilotBuilderActions manifest policy', () => {
  it('refuses CodeEmbed even when a legacy schema entry is present', () => {
    const setData = vi.fn();
    renderHook(() =>
      useCopilotBuilderActions({
        data: { content: [], root: { props: {} } } as Data,
        setData,
      })
    );
    const action = vi
      .mocked(useCopilotAction)
      .mock.calls.map(
        ([config]) =>
          config as unknown as {
            handler: (args: Record<string, unknown>) => string;
            name: string;
          }
      )
      .find((config) => config.name === 'addComponent');
    if (!action) throw new Error('Expected addComponent action');
    expect(action.handler({ componentType: 'CodeEmbed' })).toBe(
      'Component type is not insertable: CodeEmbed.'
    );
    expect(setData).not.toHaveBeenCalled();
  });
});
