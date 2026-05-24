import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import SocialMediaInput from './SocialMediaInput';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      placeholder,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (text: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        placeholder,
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

describe('SocialMediaInput', () => {
  it('renders badge text and forwards input changes', () => {
    const handleChange = vi.fn();

    render(
      <SocialMediaInput
        badge="NEW"
        colors={LIGHT_COLORS}
        icon="logo-youtube"
        label="YouTube URL"
        onChange={handleChange}
        placeholder="https://youtube.com/@channel"
        platform="youtube"
        value=""
      />
    );

    expect(screen.getByText('YouTube URL')).toBeTruthy();
    expect(screen.getByText('NEW')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('YouTube URL'), {
      target: { value: 'https://youtube.com/@baci' },
    });

    expect(handleChange).toHaveBeenCalledWith('https://youtube.com/@baci');
  });
});
