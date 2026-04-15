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
        isVideoModalVisible={false}
        linkUrl="example.com"
        onCloseVideoModal={vi.fn()}
        onAiInstructionChange={vi.fn()}
        onCloseAIModal={vi.fn()}
        onCloseLinkModal={vi.fn()}
        onConfirmAI={vi.fn()}
        onConfirmLink={onConfirmLink}
        onConfirmVideo={vi.fn()}
        onLinkUrlChange={onLinkUrlChange}
        onVideoUrlChange={vi.fn()}
        videoUrl=""
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
        isVideoModalVisible={false}
        linkUrl=""
        onCloseVideoModal={vi.fn()}
        onAiInstructionChange={vi.fn()}
        onCloseAIModal={vi.fn()}
        onCloseLinkModal={vi.fn()}
        onConfirmAI={onConfirmAI}
        onConfirmLink={vi.fn()}
        onConfirmVideo={vi.fn()}
        onLinkUrlChange={vi.fn()}
        onVideoUrlChange={vi.fn()}
        videoUrl=""
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

  it('uses the auto-polish action label when no AI instruction is provided', () => {
    const onConfirmAI = vi.fn();

    render(
      <BlogEditorDialogs
        aiInstruction=""
        colors={LIGHT_COLORS}
        isAIModalVisible={true}
        isLinkModalVisible={false}
        isVideoModalVisible={false}
        linkUrl=""
        onCloseVideoModal={vi.fn()}
        onAiInstructionChange={vi.fn()}
        onCloseAIModal={vi.fn()}
        onCloseLinkModal={vi.fn()}
        onConfirmAI={onConfirmAI}
        onConfirmLink={vi.fn()}
        onConfirmVideo={vi.fn()}
        onLinkUrlChange={vi.fn()}
        onVideoUrlChange={vi.fn()}
        videoUrl=""
      />
    );

    const actionButton = screen.getByText('Auto Polish');

    expect(actionButton).toBeInTheDocument();
    fireEvent.click(actionButton);

    expect(onConfirmAI).toHaveBeenCalledTimes(1);
  });

  it('renders the video dialog and forwards insert interactions', () => {
    const onConfirmVideo = vi.fn();
    const onVideoUrlChange = vi.fn();

    render(
      <BlogEditorDialogs
        aiInstruction=""
        colors={LIGHT_COLORS}
        isAIModalVisible={false}
        isLinkModalVisible={false}
        isVideoModalVisible={true}
        linkUrl=""
        onCloseVideoModal={vi.fn()}
        onAiInstructionChange={vi.fn()}
        onCloseAIModal={vi.fn()}
        onCloseLinkModal={vi.fn()}
        onConfirmAI={vi.fn()}
        onConfirmLink={vi.fn()}
        onConfirmVideo={onConfirmVideo}
        onLinkUrlChange={vi.fn()}
        onVideoUrlChange={onVideoUrlChange}
        videoUrl="https://youtu.be/ABCDEFGHIJK"
      />
    );

    expect(
      screen.getByRole('group', { name: 'Insert video dialog' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'Insert link dialog' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'AI edit dialog' })
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://youtu.be/LMNOPQRSTUV' },
    });
    fireEvent.click(screen.getByText('Insert'));

    expect(onVideoUrlChange).toHaveBeenCalledWith(
      'https://youtu.be/LMNOPQRSTUV'
    );
    expect(onConfirmVideo).toHaveBeenCalledTimes(1);
  });
});
