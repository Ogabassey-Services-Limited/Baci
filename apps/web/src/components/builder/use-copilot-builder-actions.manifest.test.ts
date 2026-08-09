import { builderDesignCapabilities } from '@baci/shared/contracts';
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import type { Data } from '@puckeditor/core';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCopilotBuilderActions } from './use-copilot-builder-actions';

vi.mock('@copilotkit/react-core', () => ({
  useCopilotAction: vi.fn(),
  useCopilotReadable: vi.fn(),
}));
vi.mock('./component-schema', async () => {
  const { builderDesignCapabilities: manifest } = await import(
    '@baci/shared/contracts'
  );
  return {
    COMPONENT_SCHEMA: Object.fromEntries(
      manifest.components.map(({ componentType }) => [
        componentType,
        { type: componentType },
      ])
    ),
  };
});

describe('useCopilotBuilderActions manifest policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('advertises exactly the manifest insertable types and initial schemas', () => {
    renderHook(() =>
      useCopilotBuilderActions({
        data: { content: [], root: { props: {} } } as Data,
        setData: vi.fn(),
      })
    );
    const readable = vi.mocked(useCopilotReadable).mock.calls.at(-1)?.[0] as
      | { value: string }
      | undefined;
    const addAction = vi
      .mocked(useCopilotAction)
      .mock.calls.map(
        ([config]) => config as unknown as { description: string; name: string }
      )
      .find((config) => config.name === 'addComponent');
    if (!readable || !addAction)
      throw new Error('Expected Copilot registrations');
    const advertisedTypes = Object.keys(
      JSON.parse(readable.value).availableComponents as Record<string, unknown>
    );
    const executableTypes = builderDesignCapabilities.components
      .filter(({ aiInsertable }) => aiInsertable)
      .map(({ componentType }) => componentType);

    expect(advertisedTypes).toEqual(executableTypes);
    expect(addAction.description).toBe(
      `Add a new component to the page. Available types: ${executableTypes.join(', ')}.`
    );
    expect(advertisedTypes).not.toEqual(
      expect.arrayContaining(['Header', 'Footer', 'HeroCarousel'])
    );
  });
});
