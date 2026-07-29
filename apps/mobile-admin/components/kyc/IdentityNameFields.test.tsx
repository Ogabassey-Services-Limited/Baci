import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { VerificationIdentityDraft } from './verification-identity';

vi.mock('react-native', () => ({
  StyleSheet: { create: (value: unknown) => value },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TextInput: ({
    accessibilityLabel,
    onChangeText,
    value,
  }: {
    accessibilityLabel?: string;
    onChangeText?: (value: string) => void;
    value?: string;
  }) => (
    <input
      aria-label={accessibilityLabel}
      onChange={(event) => onChangeText?.(event.target.value)}
      value={value}
    />
  ),
  View: ({
    accessibilityLabel,
    children,
    style,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    style?: CSSProperties;
  }) =>
    accessibilityLabel ? (
      <fieldset aria-label={accessibilityLabel} style={style}>
        {children}
      </fieldset>
    ) : (
      <div style={style}>{children}</div>
    ),
}));

import IdentityNameFields from './IdentityNameFields';

const colors = {
  border: '#334155',
  inputBg: '#0f172a',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  textSecondary: '#cbd5e1',
} as never;

function NameFieldsHarness() {
  const [identity, setIdentity] = useState<VerificationIdentityDraft>({
    dateOfBirth: '',
    firstName: 'Ada',
    lastName: 'Lovelace',
    mobileNo: '',
  });

  return (
    <IdentityNameFields
      colors={colors}
      disabled={false}
      firstName={identity.firstName}
      lastName={identity.lastName}
      onIdentityChange={setIdentity}
    />
  );
}

describe('IdentityNameFields', () => {
  it('keeps both editable names in one horizontal group', () => {
    render(<NameFieldsHarness />);

    const nameRow = screen.getByRole('group', {
      name: 'First and last name',
    });
    expect(nameRow).toHaveStyle({ flexDirection: 'row' });

    const firstName = within(nameRow).getByRole('textbox', {
      name: 'First name input',
    });
    const lastName = within(nameRow).getByRole('textbox', {
      name: 'Last name input',
    });

    fireEvent.change(firstName, { target: { value: 'Grace' } });
    fireEvent.change(lastName, { target: { value: 'Hopper' } });

    expect(firstName).toHaveValue('Grace');
    expect(lastName).toHaveValue('Hopper');
  });
});
