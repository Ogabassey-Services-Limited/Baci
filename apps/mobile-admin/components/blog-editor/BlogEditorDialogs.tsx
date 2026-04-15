import { Pressable, Text, TextInput, View } from 'react-native';
import { AppDialogModal } from '@/components/ui/AppDialogModal';
import { AI_TEXT_COLOR, type ThemeColors } from '@/constants/theme';
import { BLOG_EDITOR_AI_COLOR, blogEditorStyles } from './blog-editor.styles';

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
      <AppDialogModal
        keyboardAware
        onClose={onCloseLinkModal}
        visible={isLinkModalVisible}
      >
        <View
          accessibilityRole="alert"
          accessible={true}
          accessibilityLabel="Insert link dialog"
          style={[
            blogEditorStyles.dialogCard,
            { backgroundColor: colors.card },
          ]}
        >
          <Text style={[blogEditorStyles.dialogTitle, { color: colors.text }]}>
            Insert Link
          </Text>
          <Text
            style={[
              blogEditorStyles.dialogSubtitle,
              { color: colors.textSecondary },
            ]}
          >
            Add a fully qualified URL or domain.
          </Text>

          <TextInput
            accessibilityLabel="Link URL"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={onLinkUrlChange}
            onSubmitEditing={onConfirmLink}
            placeholder="https://example.com"
            placeholderTextColor={colors.textMuted}
            style={[
              blogEditorStyles.dialogInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={linkUrl}
          />

          <View style={blogEditorStyles.dialogActions}>
            <Pressable
              accessibilityLabel="Cancel link insertion"
              accessibilityRole="button"
              onPress={onCloseLinkModal}
              style={[
                blogEditorStyles.dialogButton,
                { backgroundColor: colors.border },
              ]}
            >
              <Text
                style={[
                  blogEditorStyles.dialogButtonText,
                  { color: colors.text },
                ]}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Insert link"
              accessibilityRole="button"
              onPress={onConfirmLink}
              style={[
                blogEditorStyles.dialogButton,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text
                style={[
                  blogEditorStyles.dialogButtonText,
                  { color: colors.textOnPrimary },
                ]}
              >
                Insert
              </Text>
            </Pressable>
          </View>
        </View>
      </AppDialogModal>

      <AppDialogModal
        keyboardAware
        onClose={onCloseVideoModal}
        visible={isVideoModalVisible}
      >
        <View
          accessibilityRole="alert"
          accessible={true}
          accessibilityLabel="Insert video dialog"
          style={[
            blogEditorStyles.dialogCard,
            { backgroundColor: colors.card },
          ]}
        >
          <Text style={[blogEditorStyles.dialogTitle, { color: colors.text }]}>
            Insert Video
          </Text>
          <Text
            style={[
              blogEditorStyles.dialogSubtitle,
              { color: colors.textSecondary },
            ]}
          >
            Paste a YouTube URL or video ID.
          </Text>

          <TextInput
            accessibilityLabel="Video URL"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={onVideoUrlChange}
            onSubmitEditing={onConfirmVideo}
            placeholder="https://youtu.be/ABCDEFGHIJK"
            placeholderTextColor={colors.textMuted}
            style={[
              blogEditorStyles.dialogInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={videoUrl}
          />

          <View style={blogEditorStyles.dialogActions}>
            <Pressable
              accessibilityLabel="Cancel video insertion"
              accessibilityRole="button"
              onPress={onCloseVideoModal}
              style={[
                blogEditorStyles.dialogButton,
                { backgroundColor: colors.border },
              ]}
            >
              <Text
                style={[
                  blogEditorStyles.dialogButtonText,
                  { color: colors.text },
                ]}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Insert video"
              accessibilityRole="button"
              onPress={onConfirmVideo}
              style={[
                blogEditorStyles.dialogButton,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text
                style={[
                  blogEditorStyles.dialogButtonText,
                  { color: colors.textOnPrimary },
                ]}
              >
                Insert
              </Text>
            </Pressable>
          </View>
        </View>
      </AppDialogModal>

      <AppDialogModal
        keyboardAware
        onClose={onCloseAIModal}
        visible={isAIModalVisible}
      >
        <View
          accessibilityRole="alert"
          accessible={true}
          accessibilityLabel="AI edit dialog"
          style={[
            blogEditorStyles.dialogCard,
            { backgroundColor: colors.card },
          ]}
        >
          <Text style={[blogEditorStyles.dialogTitle, { color: colors.text }]}>
            AI Copilot
          </Text>
          <Text
            style={[
              blogEditorStyles.dialogSubtitle,
              { color: colors.textSecondary },
            ]}
          >
            Tell the editor how to improve this post.
          </Text>

          <TextInput
            accessibilityLabel="AI instruction"
            blurOnSubmit
            onChangeText={onAiInstructionChange}
            onSubmitEditing={onConfirmAI}
            placeholder="e.g. Fix grammar, make it warmer, tighten the intro..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            style={[
              blogEditorStyles.dialogInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={aiInstruction}
          />

          <View style={blogEditorStyles.dialogActions}>
            <Pressable
              accessibilityLabel="Cancel AI edit"
              accessibilityRole="button"
              onPress={onCloseAIModal}
              style={[
                blogEditorStyles.dialogButton,
                { backgroundColor: colors.border },
              ]}
            >
              <Text
                style={[
                  blogEditorStyles.dialogButtonText,
                  { color: colors.text },
                ]}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Apply AI edit"
              accessibilityRole="button"
              onPress={onConfirmAI}
              style={[
                blogEditorStyles.dialogButton,
                { backgroundColor: BLOG_EDITOR_AI_COLOR },
              ]}
            >
              <Text
                style={[
                  blogEditorStyles.dialogButtonText,
                  { color: AI_TEXT_COLOR },
                ]}
              >
                {aiInstruction.trim() ? 'Transform' : 'Auto Polish'}
              </Text>
            </Pressable>
          </View>
        </View>
      </AppDialogModal>
    </>
  );
}
