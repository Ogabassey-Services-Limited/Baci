import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { MerchantSetupActionButton } from './MerchantSetupActionButton';

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span role="progressbar">Loading</span>,
  Pressable: ({
    accessibilityLabel,
    children,
    disabled,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      disabled={disabled}
      onClick={onPress}
      type="button"
    >
      {children}
    </button>
  ),
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@react-native-vector-icons/ionicons', () => ({ default: () => null }));
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: { primary: '#2563eb', textOnPrimary: '#fff' },
  }),
}));

it('runs the setup action from the branded button', () => {
  const onPress = vi.fn();
  render(
    <MerchantSetupActionButton
      icon="arrow-forward"
      label="Continue"
      onPress={onPress}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(onPress).toHaveBeenCalledOnce();
});

it('disables the setup action and shows progress while loading', () => {
  render(
    <MerchantSetupActionButton
      icon="rocket-outline"
      isLoading={true}
      label="Launch Store"
      loadingLabel="Launching store..."
      onPress={vi.fn()}
    />
  );

  expect(
    screen.getByRole('button', { name: 'Launching store...' })
  ).toBeDisabled();
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});
