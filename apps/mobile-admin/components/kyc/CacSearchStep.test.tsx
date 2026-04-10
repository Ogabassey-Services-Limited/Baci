import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import CacSearchStep from './CacSearchStep';

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: LIGHT_COLORS,
  }),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: ({ color }: { color?: string }) =>
      React.createElement('span', { 'data-color': color }, 'loading'),
    FlatList: ({
      ListEmptyComponent,
      data,
      renderItem,
    }: {
      ListEmptyComponent?: React.ReactNode;
      data?: unknown[];
      renderItem?: (item: { item: unknown }) => React.ReactNode;
    }) =>
      React.createElement(
        'div',
        null,
        data && data.length > 0
          ? data.map((item, index) =>
              React.createElement(
                'div',
                { key: index },
                renderItem?.({ item })
              )
            )
          : ListEmptyComponent
      ),
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      children?:
        | React.ReactNode
        | ((state: { pressed: boolean }) => React.ReactNode);
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          disabled,
          onClick: onPress,
          role: accessibilityRole,
        },
        typeof children === 'function' ? children({ pressed: false }) : children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      onSubmitEditing,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (text: string) => void;
      onSubmitEditing?: () => void;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        value: value ?? '',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter') onSubmitEditing?.();
        },
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('CacSearchStep', () => {
  const baseProps = {
    registrationPrefix: 'RC' as const,
    onChangeRegistrationPrefix: vi.fn(),
    rcNumber: '',
    onChangeRcNumber: vi.fn(),
    onSearch: vi.fn(),
    isSearching: false,
    results: undefined,
    onSelect: vi.fn(),
  };

  it('strips non-digit characters from the registration number input', () => {
    const onChangeRcNumber = vi.fn();

    render(
      <CacSearchStep {...baseProps} onChangeRcNumber={onChangeRcNumber} />
    );

    fireEvent.change(screen.getByLabelText('RC registration number'), {
      target: { value: 'RC-73 89a159' },
    });

    expect(onChangeRcNumber).toHaveBeenCalledWith('7389159');
  });

  it('allows switching the registration prefix outside the input', () => {
    const onChangeRegistrationPrefix = vi.fn();

    render(
      <CacSearchStep
        {...baseProps}
        onChangeRegistrationPrefix={onChangeRegistrationPrefix}
      />
    );

    fireEvent.click(screen.getByLabelText('Use BN registration type'));

    expect(onChangeRegistrationPrefix).toHaveBeenCalledWith('BN');
  });
});
