import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { BlogEditorDialogs } from './BlogEditorDialogs';

vi.mock('@/components/ui/AppDialogModal', () => ({
  AppDialogModal: ({
    accessibilityLabel,
    children,
    visible,
  }: {
    accessibilityLabel?: string;
    children?: React.ReactNode;
    visible: boolean;
  }) =>
    visible ? (
      <div aria-label={accessibilityLabel} role="dialog">
        {children}
      </div>
    ) : null,
}));

vi.mock('react-native', () => ({
  Pressable: ({
    children,
    onPress,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
  }) => (
    <button onClick={() => onPress?.()} type="button">
      {children}
    </button>
  ),
  StyleSheet: {
    absoluteFillObject: { position: 'absolute', inset: 0 },
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
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
      value={value ?? ''}
    />
  ),
  View: ({
    accessibilityLabel,
    children,
  }: {
    accessibilityLabel?: string;
    children?: React.ReactNode;
  }) => <fieldset aria-label={accessibilityLabel}>{children}</fieldset>,
}));

describe('BlogEditorDialogs', () => {
  it('renders the link dialog and forwards insert interactions', () => {
    const onConfirmLink = vi.fn();
    const onLinkUrlChange = vi.fn();

    render(
      <BlogEditorDialogs
        aiInstruction=""
        colors={LIGHT_COLORS}
        isAIModalVisible={false}
        isLinkModalVisible={true}
        linkUrl="example.com"
        onAiInstructionChange={vi.fn()}
        onCloseAIModal={vi.fn()}
        onCloseLinkModal={vi.fn()}
        onConfirmAI={vi.fn()}
        onConfirmLink={onConfirmLink}
        onLinkUrlChange={onLinkUrlChange}
      />
    );

    expect(
      screen.getByRole('group', { name: 'Insert link dialog' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'AI edit dialog' })
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Link URL'), {
      target: { value: 'baci.com' },
    });
    fireEvent.click(screen.getByText('Insert'));

    expect(onLinkUrlChange).toHaveBeenCalledWith('baci.com');
    expect(onConfirmLink).toHaveBeenCalledTimes(1);
  });

  it('renders the AI dialog and switches the primary action label', () => {
    const onConfirmAI = vi.fn();

    render(
      <BlogEditorDialogs
        aiInstruction="Tighten the intro"
        colors={LIGHT_COLORS}
        isAIModalVisible={true}
        isLinkModalVisible={false}
        linkUrl=""
        onAiInstructionChange={vi.fn()}
        onCloseAIModal={vi.fn()}
        onCloseLinkModal={vi.fn()}
        onConfirmAI={onConfirmAI}
        onConfirmLink={vi.fn()}
        onLinkUrlChange={vi.fn()}
      />
    );

    expect(
      screen.getByRole('group', { name: 'AI edit dialog' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'Insert link dialog' })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Transform'));

    expect(onConfirmAI).toHaveBeenCalledTimes(1);
  });
});
