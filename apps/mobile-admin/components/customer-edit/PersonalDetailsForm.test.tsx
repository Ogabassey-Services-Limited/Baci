import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      onBlur,
      onChangeText,
      onFocus,
      placeholder,
      value,
    }: {
      onBlur?: () => void;
      onChangeText?: (value: string) => void;
      onFocus?: () => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        value: value ?? '',
        placeholder,
        onBlur,
        onFocus,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('react-native-reanimated', async () => {
  const React = await import('react');

  return {
    default: {
      View: ({ children }: { children?: React.ReactNode }) =>
        React.createElement('div', null, children),
    },
    FadeInUp: { delay: () => ({ duration: () => ({}) }) },
  };
});

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

import { PersonalDetailsForm } from '@/components/customer-edit/PersonalDetailsForm';

function createInputStyle() {
  return {
    input: [{ borderColor: '#334155' }],
    label: [{ color: '#cbd5e1' }],
    state: {
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      color: '#f8fafc',
      shadowColor: '#3b82f6',
      shadowOpacity: 0,
    },
  };
}

describe('PersonalDetailsForm', () => {
  it('renders the section and updates first and last name fields', () => {
    const onFirstNameChange = vi.fn();
    const onLastNameChange = vi.fn();
    const onFocusField = vi.fn();

    render(
      <PersonalDetailsForm
        colors={{
          background: '#020617',
          backgroundLight: '#1e293b',
          border: '#334155',
          card: '#111827',
          primary: '#3b82f6',
          primaryLight: '#dbeafe',
          text: '#f8fafc',
          textMuted: '#94a3b8',
          textSecondary: '#cbd5e1',
        }}
        firstName="John"
        inputStyle={createInputStyle}
        lastName="Doe"
        onFirstNameChange={onFirstNameChange}
        onFocusField={onFocusField}
        onLastNameChange={onLastNameChange}
        shadows={{ md: {}, sm: {} }}
      />
    );

    expect(screen.getByText('Personal Details')).toBeTruthy();
    expect(screen.getByText('First Name')).toBeTruthy();
    expect(screen.getByText('Last Name')).toBeTruthy();

    const firstNameInput = screen.getByDisplayValue('John');
    const lastNameInput = screen.getByDisplayValue('Doe');

    fireEvent.focus(firstNameInput);
    fireEvent.change(firstNameInput, { target: { value: 'Jane' } });
    fireEvent.blur(firstNameInput);

    fireEvent.focus(lastNameInput);
    fireEvent.change(lastNameInput, { target: { value: 'Smith' } });
    fireEvent.blur(lastNameInput);

    expect(onFirstNameChange).toHaveBeenCalledWith('Jane');
    expect(onLastNameChange).toHaveBeenCalledWith('Smith');
    expect(onFocusField).toHaveBeenCalledWith('firstName');
    expect(onFocusField).toHaveBeenCalledWith('lastName');
    expect(onFocusField).toHaveBeenCalledWith(null);
  });
});
