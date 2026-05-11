import { render, screen } from '@testing-library/react';
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
