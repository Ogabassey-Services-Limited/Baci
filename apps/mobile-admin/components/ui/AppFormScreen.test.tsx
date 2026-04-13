import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppFormScreen } from '@/components/ui/AppFormScreen';

const keyboardProps = vi.hoisted(() => ({
  align: 'end' as 'start' | 'center' | 'end',
  contentContainerStyle: undefined as unknown,
  keyboardVerticalOffset: 0,
  scrollEnabled: true,
}));

vi.mock('@/components/ui/AppKeyboardContainer', () => ({
  AppKeyboardContainer: ({
    align,
    children,
    contentContainerStyle,
    keyboardVerticalOffset,
    scrollEnabled,
  }: {
    align?: 'start' | 'center' | 'end';
    children?: ReactNode;
    contentContainerStyle?: unknown;
    keyboardVerticalOffset?: number;
    scrollEnabled?: boolean;
  }) => {
    keyboardProps.align = align ?? 'end';
    keyboardProps.contentContainerStyle = contentContainerStyle;
    keyboardProps.keyboardVerticalOffset = keyboardVerticalOffset ?? 0;
    keyboardProps.scrollEnabled = scrollEnabled ?? true;
    return <section aria-label="form-keyboard-container">{children}</section>;
  },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <section aria-label="form-safe-area">{children}</section>
  ),
}));

vi.mock('react-native', async () => ({
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('AppFormScreen', () => {
  beforeEach(() => {
    keyboardProps.align = 'end';
    keyboardProps.contentContainerStyle = undefined;
    keyboardProps.keyboardVerticalOffset = 0;
    keyboardProps.scrollEnabled = true;
  });

  it('renders the safe-area shell, optional header, and content', () => {
    render(
      <AppFormScreen
        footer={<div>Footer content</div>}
        header={<div>Header content</div>}
      >
        <div>Form content</div>
      </AppFormScreen>
    );

    expect(screen.getByLabelText('form-safe-area')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'form-keyboard-container' })
    ).toBeInTheDocument();
    expect(screen.getByText('Header content')).toBeInTheDocument();
    expect(screen.getByText('Form content')).toBeInTheDocument();
    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });

  it('forwards keyboard container configuration', () => {
    render(
      <AppFormScreen
        contentContainerStyle={{ padding: 24 }}
        keyboardVerticalOffset={64}
        scrollEnabled={false}
      >
        <div>Configured content</div>
      </AppFormScreen>
    );

    expect(keyboardProps.align).toBe('start');
    expect(keyboardProps.keyboardVerticalOffset).toBe(64);
    expect(keyboardProps.scrollEnabled).toBe(false);
    expect(keyboardProps.contentContainerStyle).toEqual({ padding: 24 });
  });
});
