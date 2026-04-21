import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NewOrderNotesSection } from './NewOrderNotesSection';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      placeholder,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (text: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('textarea', {
        'aria-label': accessibilityLabel,
        onChange: (event: { target: { value: string } }) =>
          onChangeText?.(event.target.value),
        placeholder,
        value: value ?? '',
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('./new-order.styles', () => ({ styles: {} }));

type ControllerShape = {
  colors: {
    card: string;
    text: string;
    textMuted: string;
  };
  notes: string;
  setNotes: ReturnType<typeof vi.fn>;
};

const makeController = (
  overrides: Partial<ControllerShape> = {}
): ControllerShape => ({
  colors: {
    card: '#ffffff',
    text: '#0f172a',
    textMuted: '#94a3b8',
  },
  notes: '',
  setNotes: vi.fn(),
  ...overrides,
});

describe('NewOrderNotesSection', () => {
  it('renders without crashing and shows the Notes label', () => {
    const controller = makeController();

    render(
      <NewOrderNotesSection
        controller={
          controller as unknown as React.ComponentProps<
            typeof NewOrderNotesSection
          >['controller']
        }
      />
    );

    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  it('calls setNotes when the input value changes', () => {
    const controller = makeController();

    render(
      <NewOrderNotesSection
        controller={
          controller as unknown as React.ComponentProps<
            typeof NewOrderNotesSection
          >['controller']
        }
      />
    );

    const textarea = screen.getByRole('textbox', { name: 'Internal notes' });
    fireEvent.change(textarea, { target: { value: 'Handle with care' } });

    expect(controller.setNotes).toHaveBeenCalledTimes(1);
    expect(controller.setNotes).toHaveBeenCalledWith('Handle with care');
  });

  it('displays the current notes value in the input', () => {
    const controller = makeController({ notes: 'Fragile items inside' });

    render(
      <NewOrderNotesSection
        controller={
          controller as unknown as React.ComponentProps<
            typeof NewOrderNotesSection
          >['controller']
        }
      />
    );

    const textarea = screen.getByRole('textbox', { name: 'Internal notes' });
    expect(textarea).toHaveValue('Fragile items inside');
  });
});
