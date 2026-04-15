import { AI_TEXT_COLOR, type ThemeColors } from '@/constants/theme';
import { BlogEditorDialogCard } from './BlogEditorDialogCard';
import { BLOG_EDITOR_AI_COLOR } from './blog-editor.styles';

interface BlogEditorDialogsProps {
  aiInstruction: string;
  colors: ThemeColors;
  isAIModalVisible: boolean;
  isLinkModalVisible: boolean;
  isVideoModalVisible: boolean;
  linkUrl: string;
  onCloseVideoModal: () => void;
  onAiInstructionChange: (value: string) => void;
  onCloseAIModal: () => void;
  onCloseLinkModal: () => void;
  onConfirmAI: () => void;
  onConfirmLink: () => void;
  onConfirmVideo: () => void;
  onLinkUrlChange: (value: string) => void;
  onVideoUrlChange: (value: string) => void;
  videoUrl: string;
}

export function BlogEditorDialogs({
  aiInstruction,
  colors,
  isAIModalVisible,
  isLinkModalVisible,
  isVideoModalVisible,
  linkUrl,
  onCloseVideoModal,
  onAiInstructionChange,
  onCloseAIModal,
  onCloseLinkModal,
  onConfirmAI,
  onConfirmLink,
  onConfirmVideo,
  onLinkUrlChange,
  onVideoUrlChange,
  videoUrl,
}: BlogEditorDialogsProps) {
  return (
    <>
      <BlogEditorDialogCard
        cancelAccessibilityLabel="Cancel link insertion"
        colors={colors}
        confirmAccessibilityLabel="Insert link"
        confirmButtonColor={colors.primary}
        confirmLabel="Insert"
        confirmTextColor={colors.textOnPrimary}
        dialogLabel="Insert link dialog"
        inputAccessibilityLabel="Link URL"
        inputProps={{
          autoCapitalize: 'none',
          autoCorrect: false,
          keyboardType: 'url',
        }}
        onCancel={onCloseLinkModal}
        onChangeText={onLinkUrlChange}
        onConfirm={onConfirmLink}
        placeholder="https://example.com"
        subtitle="Add a fully qualified URL or domain."
        title="Insert Link"
        value={linkUrl}
        visible={isLinkModalVisible}
      />

      <BlogEditorDialogCard
        cancelAccessibilityLabel="Cancel video insertion"
        colors={colors}
        confirmAccessibilityLabel="Insert video"
        confirmButtonColor={colors.primary}
        confirmLabel="Insert"
        confirmTextColor={colors.textOnPrimary}
        dialogLabel="Insert video dialog"
        inputAccessibilityLabel="Video URL"
        inputProps={{
          autoCapitalize: 'none',
          autoCorrect: false,
          keyboardType: 'url',
        }}
        onCancel={onCloseVideoModal}
        onChangeText={onVideoUrlChange}
        onConfirm={onConfirmVideo}
        placeholder="https://youtu.be/ABCDEFGHIJK"
        subtitle="Paste a YouTube URL or video ID."
        title="Insert Video"
        value={videoUrl}
        visible={isVideoModalVisible}
      />

      <BlogEditorDialogCard
        cancelAccessibilityLabel="Cancel AI edit"
        colors={colors}
        confirmAccessibilityLabel="Apply AI edit"
        confirmButtonColor={BLOG_EDITOR_AI_COLOR}
        confirmLabel={aiInstruction.trim() ? 'Transform' : 'Auto Polish'}
        confirmTextColor={AI_TEXT_COLOR}
        dialogLabel="AI edit dialog"
        inputAccessibilityLabel="AI instruction"
        inputProps={{
          blurOnSubmit: true,
          returnKeyType: 'done',
        }}
        onCancel={onCloseAIModal}
        onChangeText={onAiInstructionChange}
        onConfirm={onConfirmAI}
        placeholder="e.g. Fix grammar, make it warmer, tighten the intro..."
        subtitle="Tell the editor how to improve this post."
        title="AI Copilot"
        value={aiInstruction}
        visible={isAIModalVisible}
      />
    </>
  );
}
