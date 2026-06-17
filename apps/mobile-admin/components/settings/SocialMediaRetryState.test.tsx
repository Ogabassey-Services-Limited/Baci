import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import SocialMediaRetryState from './SocialMediaRetryState';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      accessibilityRole,
      children,
      onPress,
    }: {
      accessibilityRole?: string;
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        { type: 'button', role: accessibilityRole, onClick: onPress },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@react-native-vector-icons/ionicons', async () => {
  const React = await import('react');

  return {
    default: ({ name }: { name: string }) =>
      React.createElement('span', { 'aria-hidden': true }, name),
    Ionicons: ({ name }: { name: string }) =>
      React.createElement('span', { 'aria-hidden': true }, name),
    __esModule: true,
  };
});

describe('SocialMediaRetryState', () => {
  it('renders the safe retry copy and calls onRetry from the button', () => {
    const handleRetry = vi.fn();

    render(
      <SocialMediaRetryState colors={LIGHT_COLORS} onRetry={handleRetry} />
    );

    expect(screen.getByText("Couldn't load your settings")).toBeTruthy();
    expect(
      screen.getByText(/Saving now could overwrite your saved links/i)
    ).toBeTruthy();

    expect(handleRetry).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(handleRetry).toHaveBeenCalledOnce();
  });
});
