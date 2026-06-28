import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import type { Data } from '@puckeditor/core';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCopilotBuilderActions } from './use-copilot-builder-actions';

vi.mock('@copilotkit/react-core', () => ({
  useCopilotAction: vi.fn(),
  useCopilotReadable: vi.fn(),
}));

// Mock COMPONENT_SCHEMA for deterministic testing
vi.mock('./component-schema', () => ({
  COMPONENT_SCHEMA: {
    Hero: { type: 'Hero' },
    ProductGrid: { type: 'ProductGrid' },
  },
}));

describe('useCopilotBuilderActions', () => {
  let mockSetData: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetData = vi.fn();
  });

  it('registers copilot readable state', () => {
    const data: Data = { root: { props: {} }, content: [] };

    renderHook(() => useCopilotBuilderActions({ data, setData: mockSetData }));

    expect(useCopilotReadable).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.any(String),
        value: expect.any(String),
      })
    );
  });

  describe('addComponent action', () => {
    it('adds a component at the bottom by default', () => {
      const data: Data = {
        root: { props: {} },
        content: [{ type: 'Hero', props: { id: 'hero-1' } }],
      };
      renderHook(() =>
        useCopilotBuilderActions({ data, setData: mockSetData })
      );

      const addComponentCall = (useCopilotAction as any).mock.calls.find(
        (call: any) => call[0].name === 'addComponent'
      );

      const handler = addComponentCall[0].handler;

      const result = handler({
        componentType: 'ProductGrid',
        props: '{"title": "New Grid"}',
      });

      expect(result).toContain('Added ProductGrid at position bottom');
      expect(mockSetData).toHaveBeenCalledWith({
        root: { props: {} },
        content: [
          { type: 'Hero', props: { id: 'hero-1' } },
          {
            type: 'ProductGrid',
            props: expect.objectContaining({ title: 'New Grid' }),
          },
        ],
      });
    });

    it('adds a component at a specific position', () => {
      const data: Data = {
        root: { props: {} },
        content: [{ type: 'Hero', props: { id: 'hero-1' } }],
      };
      renderHook(() =>
        useCopilotBuilderActions({ data, setData: mockSetData })
      );

      const addComponentCall = (useCopilotAction as any).mock.calls.find(
        (call: any) => call[0].name === 'addComponent'
      );

      const handler = addComponentCall[0].handler;

      handler({ componentType: 'ProductGrid', position: 0 });

      expect(mockSetData).toHaveBeenCalledWith({
        root: { props: {} },
        content: [
          { type: 'ProductGrid', props: expect.any(Object) },
          { type: 'Hero', props: { id: 'hero-1' } },
        ],
      });
    });

    it('returns error string for invalid component type', () => {
      const data: Data = { root: { props: {} }, content: [] };
      renderHook(() =>
        useCopilotBuilderActions({ data, setData: mockSetData })
      );

      const addComponentCall = (useCopilotAction as any).mock.calls.find(
        (call: any) => call[0].name === 'addComponent'
      );

      const handler = addComponentCall[0].handler;

      const result = handler({ componentType: 'InvalidType' });

      expect(result).toContain('Invalid component type: InvalidType');
      expect(mockSetData).not.toHaveBeenCalled();
    });
  });

  describe('updateComponent action', () => {
    it('updates an existing component', () => {
      const data: Data = {
        root: { props: {} },
        content: [
          { type: 'Hero', props: { id: 'hero-1', title: 'Old Title' } },
        ],
      };
      renderHook(() =>
        useCopilotBuilderActions({ data, setData: mockSetData })
      );

      const updateComponentCall = (useCopilotAction as any).mock.calls.find(
        (call: any) => call[0].name === 'updateComponent'
      );

      const handler = updateComponentCall[0].handler;

      const result = handler({ index: 0, updates: '{"title": "New Title"}' });

      expect(result).toContain('Updated component at index 0');
      expect(mockSetData).toHaveBeenCalledWith({
        root: { props: {} },
        content: [
          { type: 'Hero', props: { id: 'hero-1', title: 'New Title' } },
        ],
      });
    });

    it('returns error string for invalid index', () => {
      const data: Data = {
        root: { props: {} },
        content: [{ type: 'Hero', props: { id: 'hero-1' } }],
      };
      renderHook(() =>
        useCopilotBuilderActions({ data, setData: mockSetData })
      );

      const updateComponentCall = (useCopilotAction as any).mock.calls.find(
        (call: any) => call[0].name === 'updateComponent'
      );

      const handler = updateComponentCall[0].handler;

      const result = handler({ index: 1, updates: '{}' });

      expect(result).toContain('Invalid index: 1. Component not found.');
      expect(mockSetData).not.toHaveBeenCalled();
    });

    it('returns error string for invalid JSON', () => {
      const data: Data = {
        root: { props: {} },
        content: [{ type: 'Hero', props: { id: 'hero-1' } }],
      };
      renderHook(() =>
        useCopilotBuilderActions({ data, setData: mockSetData })
      );

      const updateComponentCall = (useCopilotAction as any).mock.calls.find(
        (call: any) => call[0].name === 'updateComponent'
      );

      const handler = updateComponentCall[0].handler;

      const result = handler({ index: 0, updates: 'invalid-json' });

      expect(result).toContain('Failed to parse updates JSON.');
      expect(mockSetData).not.toHaveBeenCalled();
    });
  });

  describe('removeComponent action', () => {
    it('removes a component at the specified index', () => {
      const data: Data = {
        root: { props: {} },
        content: [
          { type: 'Hero', props: { id: 'hero-1' } },
          { type: 'ProductGrid', props: { id: 'grid-1' } },
        ],
      };
      renderHook(() =>
        useCopilotBuilderActions({ data, setData: mockSetData })
      );

      const removeComponentCall = (useCopilotAction as any).mock.calls.find(
        (call: any) => call[0].name === 'removeComponent'
      );

      const handler = removeComponentCall[0].handler;

      const result = handler({ index: 0 });

      expect(result).toContain('Removed Hero at index 0');
      expect(mockSetData).toHaveBeenCalledWith({
        root: { props: {} },
        content: [{ type: 'ProductGrid', props: { id: 'grid-1' } }],
      });
    });

    it('returns error string for invalid index', () => {
      const data: Data = {
        root: { props: {} },
        content: [{ type: 'Hero', props: { id: 'hero-1' } }],
      };
      renderHook(() =>
        useCopilotBuilderActions({ data, setData: mockSetData })
      );

      const removeComponentCall = (useCopilotAction as any).mock.calls.find(
        (call: any) => call[0].name === 'removeComponent'
      );

      const handler = removeComponentCall[0].handler;

      const result = handler({ index: 1 });

      expect(result).toContain('Invalid index: 1');
      expect(mockSetData).not.toHaveBeenCalled();
    });
  });
});
