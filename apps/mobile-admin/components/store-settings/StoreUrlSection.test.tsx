import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS, SHADOWS } from '@/constants/theme';
import { StoreUrlSection } from './StoreUrlSection';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: ({ accessibilityLabel }: { accessibilityLabel?: string }) => (
    <span aria-label={accessibilityLabel} role="img" />
  ),
}));

vi.mock('react-native', () => ({
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TextInput: ({
    accessibilityHint,
    accessibilityLabel,
    editable = true,
    onChangeText,
    value,
  }: {
    accessibilityHint?: string;
    accessibilityLabel?: string;
    editable?: boolean;
    onChangeText?: (text: string) => void;
    value?: string;
  }) => (
    <input
      aria-label={accessibilityLabel}
      data-accessibility-hint={accessibilityHint}
      onChange={(event) => {
        if (editable) onChangeText?.(event.target.value);
      }}
      readOnly={!editable}
      value={value ?? ''}
    />
  ),
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('StoreUrlSection', () => {
  const onSlugChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows slug edits before the store URL is established', () => {
    render(
      <StoreUrlSection
        colors={LIGHT_COLORS}
        onSlugChange={onSlugChange}
        shadowStyle={SHADOWS.sm}
        slug="baci-foods"
        slugLocked={false}
      />
    );

    fireEvent.change(screen.getByLabelText('Store slug'), {
      target: { value: 'baci-stores' },
    });

    expect(screen.getByLabelText('Store slug')).toHaveAttribute(
      'data-accessibility-hint',
      'This is your unique store link. Changing it will break existing links.'
    );
    expect(onSlugChange).toHaveBeenCalledWith('baci-stores');
    expect(
      screen.getByText(
        'This is your unique store link. Changing it will break existing links.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: 'Store URL locked' })
    ).not.toBeInTheDocument();
  });

  it('locks the slug input after the store URL is established', () => {
    render(
      <StoreUrlSection
        colors={LIGHT_COLORS}
        onSlugChange={onSlugChange}
        shadowStyle={SHADOWS.sm}
        slug="baci-foods"
        slugLocked
      />
    );

    const slugInput = screen.getByLabelText('Store slug');

    expect(slugInput).toHaveAttribute('readonly');
    expect(slugInput).toHaveAttribute(
      'data-accessibility-hint',
      'Store links are locked after setup. Contact support if you need a change.'
    );
    expect(
      screen.getByText(
        'Store links are locked after setup. Contact support if you need a change.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Store URL locked' })
    ).toBeInTheDocument();

    fireEvent.change(slugInput, {
      target: { value: 'baci-stores' },
    });

    expect(onSlugChange).not.toHaveBeenCalled();
  });
});
