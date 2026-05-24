import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { LegalEntityCard } from './LegalEntityCard';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: ({ color }: { color?: string }) =>
      React.createElement('span', { 'data-color': color }, 'loading'),
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { disabled?: boolean };
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-disabled': accessibilityState?.disabled,
          'aria-label': accessibilityLabel,
          disabled,
          onClick: onPress,
          role: accessibilityRole,
        },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (text: string) => void;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        value: value ?? '',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@react-native-vector-icons/ionicons/static', async () => {
  const React = await import('react');

  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement('span', null, name),

    default: ({ name }: { name: string }) =>
      React.createElement('span', null, name),
    __esModule: true,
  };
});

describe('LegalEntityCard', () => {
  const baseProps = {
    colors: LIGHT_COLORS,
    shadowStyle: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    legalEntityName: 'Acme Enterprises',
    isPending: false,
    onChangeText: vi.fn(),
    onSave: vi.fn(),
  };

  it('renders the provided value and icon, and forwards text changes', () => {
    const onChangeText = vi.fn();

    render(<LegalEntityCard {...baseProps} onChangeText={onChangeText} />);

    expect(screen.getByText('business-outline')).toBeTruthy();
    expect(screen.getByDisplayValue('Acme Enterprises')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Legal entity name'), {
      target: { value: 'Baci Ventures' },
    });

    expect(onChangeText).toHaveBeenCalledWith('Baci Ventures');
  });

  it('calls onSave when the save button is pressed', () => {
    const onSave = vi.fn();

    render(<LegalEntityCard {...baseProps} onSave={onSave} />);

    fireEvent.click(screen.getByLabelText('Save legal entity'));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('shows a loading indicator and disables submit while pending', () => {
    render(<LegalEntityCard {...baseProps} isPending={true} />);

    expect(screen.getByText('loading')).toBeTruthy();
    expect(screen.queryByText('Save')).toBeNull();
    expect(
      (screen.getByLabelText('Save legal entity') as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('shows the save label when not pending', () => {
    render(<LegalEntityCard {...baseProps} />);

    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.queryByText('loading')).toBeNull();
  });
});
