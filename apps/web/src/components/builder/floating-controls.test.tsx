import { usePuck } from '@puckeditor/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { FloatingControls } from './floating-controls';

// Mock the usePuck hook
vi.mock('@puckeditor/core', () => ({
  __esModule: true,
  usePuck: vi.fn(),
}));

describe('FloatingControls', () => {
  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with a valid Puck state shape', () => {
    (usePuck as ReturnType<typeof vi.fn>).mockReturnValue({
      dispatch: mockDispatch,
      config: {
        components: {
          TestComponent: {
            label: 'Test Component',
            fields: {
              title: {
                type: 'text',
                label: 'Title Field',
              },
            },
          },
        },
      },
      appState: {
        ui: {
          selectedItem: {
            type: 'TestComponent',
            props: {
              id: 'test-id',
              title: 'Hello World',
            },
          },
        },
        data: {
          content: [
            {
              type: 'TestComponent',
              props: {
                id: 'test-id',
                title: 'Hello World',
              },
            },
          ],
        },
      },
    });

    render(<FloatingControls />);

    // Check if the component title is rendered
    expect(screen.getByText('Edit Test Component')).toBeInTheDocument();

    // Check if the field is rendered
    expect(screen.getByText('Title Field')).toBeInTheDocument();

    // Check if the input value matches
    expect(screen.getByDisplayValue('Hello World')).toBeInTheDocument();
  });

  it('calls dispatch to update field data when input changes', () => {
    (usePuck as ReturnType<typeof vi.fn>).mockReturnValue({
      dispatch: mockDispatch,
      config: {
        components: {
          TestComponent: {
            label: 'Test Component',
            fields: {
              title: {
                type: 'text',
                label: 'Title Field',
              },
            },
          },
        },
      },
      appState: {
        ui: {
          selectedItem: {
            type: 'TestComponent',
            props: {
              id: 'test-id',
              title: 'Hello World',
            },
          },
        },
        data: {
          content: [
            {
              type: 'TestComponent',
              props: {
                id: 'test-id',
                title: 'Hello World',
              },
            },
          ],
        },
      },
    });

    render(<FloatingControls />);

    const input = screen.getByDisplayValue('Hello World');
    fireEvent.change(input, { target: { value: 'New Title' } });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'setData',
      data: {
        content: [
          {
            type: 'TestComponent',
            props: {
              id: 'test-id',
              title: 'New Title',
            },
          },
        ],
      },
    });
  });

  it('calls dispatch to clear selection when close button is clicked', () => {
    (usePuck as ReturnType<typeof vi.fn>).mockReturnValue({
      dispatch: mockDispatch,
      config: {
        components: {
          TestComponent: {
            label: 'Test Component',
            fields: {
              title: {
                type: 'text',
              },
            },
          },
        },
      },
      appState: {
        ui: {
          selectedItem: {
            type: 'TestComponent',
            props: {
              id: 'test-id',
              title: 'Hello World',
            },
          },
        },
        data: {
          content: [
            {
              type: 'TestComponent',
              props: {
                id: 'test-id',
                title: 'Hello World',
              },
            },
          ],
        },
      },
    });

    render(<FloatingControls />);

    const closeBtn = screen.getByLabelText('Close controls');
    fireEvent.click(closeBtn);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'setUi',
      ui: { itemSelector: null },
    });
  });
});
