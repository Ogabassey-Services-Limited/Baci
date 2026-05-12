import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockUsePuck = vi.fn();

vi.mock('@puckeditor/core', () => ({
  usePuck: () => mockUsePuck(),
}));

import { FloatingControls } from './floating-controls';

describe('FloatingControls', () => {
  it('renders nothing when appState is null', () => {
    mockUsePuck.mockReturnValue({
      appState: null,
      dispatch: vi.fn(),
      config: { components: {} },
      selectedItem: null,
    });
    const { container } = render(<FloatingControls />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when appState is missing data.content', () => {
    mockUsePuck.mockReturnValue({
      appState: { ui: { itemSelector: null }, data: { root: {} } },
      dispatch: vi.fn(),
      config: { components: {} },
      selectedItem: null,
    });
    const { container } = render(<FloatingControls />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no item is selected', () => {
    mockUsePuck.mockReturnValue({
      appState: {
        ui: { itemSelector: null },
        data: { content: [], root: {} },
      },
      dispatch: vi.fn(),
      config: { components: { Heading: { fields: {} } } },
      selectedItem: null,
    });
    const { container } = render(<FloatingControls />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when config.components is missing', () => {
    const selectedItem = {
      type: 'Heading',
      props: { id: 'h1', text: 'Hello' },
    };
    mockUsePuck.mockReturnValue({
      appState: {
        ui: { itemSelector: { index: 0 } },
        data: { content: [selectedItem], root: {} },
      },
      dispatch: vi.fn(),
      config: {},
      selectedItem,
    });
    const { container } = render(<FloatingControls />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the field editor when state, selectedItem, and config are valid', () => {
    const selectedItem = {
      type: 'Heading',
      props: { id: 'h1', text: 'Hello' },
    };
    mockUsePuck.mockReturnValue({
      appState: {
        ui: { itemSelector: { index: 0 } },
        data: { content: [selectedItem], root: {} },
      },
      dispatch: vi.fn(),
      config: {
        components: {
          Heading: {
            label: 'Heading',
            fields: {
              text: { type: 'text', label: 'Text' },
            },
          },
        },
      },
      selectedItem,
    });
    render(<FloatingControls />);
    expect(screen.getByText(/edit heading/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Hello')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /close controls/i })
    ).toBeInTheDocument();
  });

  it('dispatches setData targeting the matching zone when editing a dropzone-nested item', () => {
    const dispatch = vi.fn();
    const nestedItem = {
      type: 'Heading',
      props: { id: 'nested-h1', text: 'Nested' },
    };
    const otherRootItem = {
      type: 'Heading',
      props: { id: 'root-h1', text: 'Root' },
    };
    const zoneKey = 'Flex-1234:children';
    mockUsePuck.mockReturnValue({
      appState: {
        ui: { itemSelector: { index: 0, zone: zoneKey } },
        data: {
          content: [otherRootItem],
          root: {},
          zones: {
            [zoneKey]: [nestedItem],
            'Flex-1234:other': [],
          },
        },
      },
      dispatch,
      config: {
        components: {
          Heading: {
            label: 'Heading',
            fields: { text: { type: 'text', label: 'Text' } },
          },
        },
      },
      selectedItem: nestedItem,
    });

    render(<FloatingControls />);
    const input = screen.getByDisplayValue('Nested');
    fireEvent.change(input, { target: { value: 'NestedX' } });

    // The last setData call should update the zone, not root content.
    const setDataCalls = dispatch.mock.calls.filter(
      ([action]) => action.type === 'setData'
    );
    expect(setDataCalls.length).toBe(1);

    // Puck's setData replaces the data tree wholesale, so the dispatch
    // spreads `appState.data` and overwrites only the affected zone. Root
    // content is preserved untouched, and the unrelated `Flex-1234:other`
    // zone is preserved.
    expect(setDataCalls[0][0].data.zones[zoneKey]).toEqual([
      { type: 'Heading', props: { id: 'nested-h1', text: 'NestedX' } },
    ]);
    expect(setDataCalls[0][0].data.zones['Flex-1234:other']).toEqual([]);
    // Root content array is preserved unchanged (still contains otherRootItem).
    expect(setDataCalls[0][0].data.content).toEqual([otherRootItem]);
  });

  it('dispatches setData targeting root content when editing a root-level item', () => {
    const dispatch = vi.fn();
    const rootItem = {
      type: 'Heading',
      props: { id: 'h1', text: 'Hello' },
    };
    mockUsePuck.mockReturnValue({
      appState: {
        ui: { itemSelector: { index: 0 } },
        data: {
          content: [rootItem],
          root: {},
          zones: { 'Flex-1234:children': [] },
        },
      },
      dispatch,
      config: {
        components: {
          Heading: {
            label: 'Heading',
            fields: { text: { type: 'text', label: 'Text' } },
          },
        },
      },
      selectedItem: rootItem,
    });

    render(<FloatingControls />);
    const input = screen.getByDisplayValue('Hello');
    fireEvent.change(input, { target: { value: 'World' } });

    const setDataCalls = dispatch.mock.calls.filter(
      ([action]) => action.type === 'setData'
    );
    expect(setDataCalls.length).toBe(1);
    expect(setDataCalls[0][0].data.content).toBeDefined();
    expect(setDataCalls[0][0].data.content[0].props.text).toBe('World');
    // Puck's setData replaces the entire data tree, so we include the
    // unchanged zones to avoid wiping nested content.
    expect(setDataCalls[0][0].data.zones).toEqual({
      'Flex-1234:children': [],
    });
  });

  it('dispatches setUi with itemSelector: null when close button is clicked', async () => {
    const dispatch = vi.fn();
    const selectedItem = {
      type: 'Heading',
      props: { id: 'h1', text: 'Hello' },
    };
    mockUsePuck.mockReturnValue({
      appState: {
        ui: { itemSelector: { index: 0 } },
        data: { content: [selectedItem], root: {} },
      },
      dispatch,
      config: {
        components: {
          Heading: {
            label: 'Heading',
            fields: { text: { type: 'text' } },
          },
        },
      },
      selectedItem,
    });
    const { default: userEventModule } = await import(
      '@testing-library/user-event'
    );
    const user = userEventModule.setup();
    render(<FloatingControls />);
    await user.click(screen.getByRole('button', { name: /close controls/i }));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'setUi',
      ui: { itemSelector: null },
    });
  });
});
