import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import BvnMobileNumberField from './BvnMobileNumberField';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      accessibilityLabel,
      editable,
      onChangeText,
      placeholder,
      value,
    }: {
      accessibilityLabel?: string;
      editable?: boolean;
      onChangeText?: (text: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        disabled: editable === false,
        placeholder,
        value: value ?? '',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
  };
});

describe('BvnMobileNumberField', () => {
  it('renders the label, placeholder, and initial value', () => {
    render(
      <BvnMobileNumberField
        colors={LIGHT_COLORS}
        disabled={false}
        mobileNo="08012345678"
        onChangeText={vi.fn()}
      />
    );

    expect(screen.getByText('Mobile Number')).toBeTruthy();
    expect(screen.getByPlaceholderText('08012345678')).toHaveProperty(
      'value',
      '08012345678'
    );
  });

  it('sanitizes input to digits only and truncates to 11 characters', () => {
    const onChangeText = vi.fn();

    render(
      <BvnMobileNumberField
        colors={LIGHT_COLORS}
        disabled={false}
        mobileNo=""
        onChangeText={onChangeText}
      />
    );

    fireEvent.change(screen.getByLabelText('Mobile number input'), {
      target: { value: '08a1-23b4567899' },
    });

    expect(onChangeText).toHaveBeenCalledWith('08123456789');
  });

  it('does not allow editing when disabled', () => {
    const onChangeText = vi.fn();

    render(
      <BvnMobileNumberField
        colors={LIGHT_COLORS}
        disabled
        mobileNo="08012345678"
        onChangeText={onChangeText}
      />
    );

    const input = screen.getByLabelText('Mobile number input');
    expect(input).toHaveProperty('disabled', true);
    fireEvent.change(input, { target: { value: '07000000000' } });
    expect(onChangeText).not.toHaveBeenCalled();
  });
});
