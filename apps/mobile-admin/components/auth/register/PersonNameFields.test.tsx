import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      accessibilityLabel,
      autoComplete,
      onChangeText,
      textContentType,
      value,
    }: {
      accessibilityLabel?: string;
      autoComplete?: string;
      onChangeText?: (value: string) => void;
      textContentType?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        'data-autocomplete': autoComplete,
        'data-text-content-type': textContentType,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        value,
      }),
  };
});
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      border: '#ddd',
      inputBg: '#fff',
      text: '#111',
      textMuted: '#666',
    },
  }),
}));

import { PersonNameFields } from './PersonNameFields';

describe('PersonNameFields', () => {
  it('sentence-cases typed or pasted names and preserves iOS AutoFill semantics', () => {
    const onFirstNameChange = vi.fn();
    const onLastNameChange = vi.fn();
    render(
      <PersonNameFields
        firstName=""
        lastName=""
        onFirstNameChange={onFirstNameChange}
        onLastNameChange={onLastNameChange}
      />
    );

    const firstName = screen.getByLabelText('First Name');
    const lastName = screen.getByLabelText('Last Name');
    fireEvent.change(firstName, { target: { value: 'aDA' } });
    fireEvent.change(lastName, { target: { value: 'lOVELACE' } });

    expect(onFirstNameChange).toHaveBeenCalledWith('Ada');
    expect(onLastNameChange).toHaveBeenCalledWith('Lovelace');
    expect(firstName).toHaveAttribute('data-autocomplete', 'given-name');
    expect(firstName).toHaveAttribute('data-text-content-type', 'givenName');
    expect(lastName).toHaveAttribute('data-autocomplete', 'family-name');
    expect(lastName).toHaveAttribute('data-text-content-type', 'familyName');
  });
});
