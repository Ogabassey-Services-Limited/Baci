import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { BlogEditorToolbar } from './BlogEditorToolbar';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
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
      onClick={() => onPress?.()}
      type="button"
    >
      {children}
    </button>
  ),
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    absoluteFillObject: { position: 'absolute', inset: 0 },
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('BlogEditorToolbar', () => {
  it('forwards core formatting and insertion actions', () => {
    const onFormatAction = vi.fn();
    const onInsertImage = vi.fn();
    const onInsertLink = vi.fn();

    render(
      <BlogEditorToolbar
        colors={LIGHT_COLORS}
        isUploadingImage={false}
        onFormatAction={onFormatAction}
        onInsertImage={onInsertImage}
        onInsertLink={onInsertLink}
        onInsertTable={vi.fn()}
        onInsertVideo={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Heading 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Insert link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Insert image' }));

    expect(onFormatAction).toHaveBeenCalledWith('undo');
    expect(onFormatAction).toHaveBeenCalledWith('formatBlock', 'h2');
    expect(onInsertLink).toHaveBeenCalledTimes(1);
    expect(onInsertImage).toHaveBeenCalledTimes(1);
  });

  it('disables image insertion while an upload is in progress', () => {
    render(
      <BlogEditorToolbar
        colors={LIGHT_COLORS}
        isUploadingImage={true}
        onFormatAction={vi.fn()}
        onInsertImage={vi.fn()}
        onInsertLink={vi.fn()}
        onInsertTable={vi.fn()}
        onInsertVideo={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Insert image' })).toBeDisabled();
    expect(screen.getByText('loading')).toBeInTheDocument();
  });
});
