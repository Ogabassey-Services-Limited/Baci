import Ionicons from "@react-native-vector-icons/ionicons/static";
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { BlogEditorDialogs } from '@/components/blog-editor/BlogEditorDialogs';
import { BlogEditorToolbar } from '@/components/blog-editor/BlogEditorToolbar';
import {
  BLOG_EDITOR_AI_COLOR,
  blogEditorStyles,
} from '@/components/blog-editor/blog-editor.styles';
import {
  buildApplyEditorThemeScript,
  createEditorHtml,
} from '@/components/blog-editor/create-editor-html';
import { AppFormScreen } from '@/components/ui/AppFormScreen';
import { SPACING } from '@/constants/theme';
import { useBlogEditor } from '@/hooks/useBlogEditor';
import { useTheme } from '@/hooks/useTheme';

export default function EditContentScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const initialThemeRef = useRef(colors);
  const {
    aiInstruction,
    closeAIModal,
    closeLinkModal,
    closeVideoModal,
    confirmInsertVideo,
    errorMessage,
    formatAction,
    handleImagePick,
    handleInsertLink,
    handleInsertTable,
    handleInsertVideo,
    handleSave,
    isAIModalVisible,
    isAIProcessing,
    isLinkModalVisible,
    isLoading,
    isSaving,
    isUploadingImage,
    isVideoModalVisible,
    initialEditorContent,
    linkUrl,
    onWebViewMessage,
    openAIModal,
    openLinkModal,
    requestAIEdit,
    retryLoad,
    setAiInstruction,
    setLinkUrl,
    setVideoUrl,
    videoUrl,
  } = useBlogEditor({ id, webViewRef });
  const editorHtml = createEditorHtml({
    colors: initialThemeRef.current,
    content: initialEditorContent,
  });

  useEffect(() => {
    webViewRef.current?.injectJavaScript(buildApplyEditorThemeScript(colors));
  }, [colors]);

  if (isLoading) {
    return (
      <View
        style={[
          blogEditorStyles.container,
          {
            alignItems: 'center',
            backgroundColor: colors.background,
            justifyContent: 'center',
          },
        ]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View
        style={[
          blogEditorStyles.container,
          {
            alignItems: 'center',
            backgroundColor: colors.background,
            justifyContent: 'center',
            paddingHorizontal: SPACING['2xl'],
          },
        ]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <Text
          style={[
            blogEditorStyles.headerTitle,
            { color: colors.text, marginBottom: 12 },
          ]}
        >
          Unable to load editor
        </Text>
        <Text
          style={[
            blogEditorStyles.saveText,
            { color: colors.text, marginBottom: 20, textAlign: 'center' },
          ]}
        >
          {errorMessage}
        </Text>
        <Pressable
          accessibilityLabel="Retry loading editor"
          accessibilityRole="button"
          onPress={retryLoad}
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
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[
        blogEditorStyles.container,
        { backgroundColor: colors.background },
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {isAIProcessing ? (
        <View
          style={[
            blogEditorStyles.loadingOverlay,
            { backgroundColor: colors.backdrop },
          ]}
        >
          <View
            style={[
              blogEditorStyles.loadingCard,
              { backgroundColor: colors.card },
            ]}
          >
            <ActivityIndicator color={BLOG_EDITOR_AI_COLOR} size="large" />
            <Text
              style={[blogEditorStyles.loadingText, { color: colors.text }]}
            >
              Polishing with AI...
            </Text>
          </View>
        </View>
      ) : null}

      <BlogEditorDialogs
        aiInstruction={aiInstruction}
        colors={colors}
        isAIModalVisible={isAIModalVisible}
        isLinkModalVisible={isLinkModalVisible}
        isVideoModalVisible={isVideoModalVisible}
        linkUrl={linkUrl}
        onCloseVideoModal={closeVideoModal}
        onAiInstructionChange={setAiInstruction}
        onCloseAIModal={closeAIModal}
        onCloseLinkModal={closeLinkModal}
        onConfirmAI={requestAIEdit}
        onConfirmLink={handleInsertLink}
        onConfirmVideo={confirmInsertVideo}
        onLinkUrlChange={setLinkUrl}
        onVideoUrlChange={setVideoUrl}
        videoUrl={videoUrl}
      />

      <AppFormScreen
        contentContainerStyle={blogEditorStyles.formContent}
        footer={
          <BlogEditorToolbar
            colors={colors}
            isUploadingImage={isUploadingImage}
            onFormatAction={formatAction}
            onInsertImage={handleImagePick}
            onInsertLink={openLinkModal}
            onInsertTable={handleInsertTable}
            onInsertVideo={handleInsertVideo}
          />
        }
        header={
          <View
            style={[
              blogEditorStyles.header,
              { borderBottomColor: colors.border },
            ]}
          >
            <Pressable
              accessibilityLabel="Close editor"
              accessibilityRole="button"
              onPress={() => router.back()}
              style={blogEditorStyles.backButton}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
            <Text
              style={[blogEditorStyles.headerTitle, { color: colors.text }]}
            >
              Edit Content
            </Text>
            <Pressable
              accessibilityLabel="Save content"
              accessibilityRole="button"
              disabled={isSaving || isAIProcessing}
              onPress={handleSave}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text
                  style={[blogEditorStyles.saveText, { color: colors.primary }]}
                >
                  Done
                </Text>
              )}
            </Pressable>
          </View>
        }
        scrollEnabled={false}
        style={[
          blogEditorStyles.container,
          { backgroundColor: colors.background },
        ]}
      >
        <View style={blogEditorStyles.editorContainer}>
          <WebView
            keyboardDisplayRequiresUserAction={false}
            onLoadEnd={() =>
              webViewRef.current?.injectJavaScript(
                buildApplyEditorThemeScript(colors)
              )
            }
            onMessage={onWebViewMessage}
            originWhitelist={['*']}
            ref={webViewRef}
            scrollEnabled={true}
            source={{ html: editorHtml }}
            style={{ backgroundColor: colors.background, flex: 1 }}
          />
        </View>
      </AppFormScreen>

      <Pressable
        accessibilityLabel="Open AI editor"
        accessibilityRole="button"
        disabled={isAIProcessing}
        onPress={openAIModal}
        style={[
          blogEditorStyles.fab,
          { backgroundColor: BLOG_EDITOR_AI_COLOR },
        ]}
      >
        {isAIProcessing ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Ionicons name="sparkles" size={26} color="#FFF" />
        )}
      </Pressable>
    </View>
  );
}
