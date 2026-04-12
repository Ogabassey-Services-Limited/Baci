import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RegisterLegalText } from '@/components/auth/register/RegisterLegalText';

const mocks = vi.hoisted(() => ({
  openURL: vi.fn(),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Linking: { openURL: mocks.openURL },
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      style?: unknown;
    }) => React.createElement('span', { onClick: onPress }, children),
  };
});

describe('RegisterLegalText', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the legal copy and opens the terms and privacy links', () => {
    render(
      <RegisterLegalText
        linkColor="#2563eb"
        prefixText="By creating an account, you agree to our"
        textColor="#6b7280"
      />
    );

    expect(
      screen.getByText((content) =>
        content.includes('By creating an account, you agree to our')
      )
    ).toBeTruthy();
    expect(screen.getByText('Terms of Service')).toBeTruthy();
    expect(screen.getByText('Privacy Policy')).toBeTruthy();

    fireEvent.click(screen.getByText('Terms of Service'));
    fireEvent.click(screen.getByText('Privacy Policy'));

    expect(mocks.openURL).toHaveBeenNthCalledWith(
      1,
      'https://usebaci.com/terms'
    );
    expect(mocks.openURL).toHaveBeenNthCalledWith(
      2,
      'https://usebaci.com/privacy'
    );
  });
});
