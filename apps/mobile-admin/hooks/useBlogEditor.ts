import { router } from 'expo-router';
import { type RefObject, useState } from 'react';
import { Alert } from 'react-native';
import type { WebView } from 'react-native-webview';
import { requestBlogEditorAiEdit } from '@/components/blog-editor/blog-editor-api';
import {
  buildAiRequestScript,
  buildCreateLinkScript,
  buildFormatActionScript,
  buildInsertTableScript,
  buildInsertVideoScript,
  buildSaveRequestScript,
  type FormatCommand,
} from '@/components/blog-editor/blog-editor-commands';
import { normalizeBlogPostId } from '@/components/blog-editor/blog-editor-helpers';
import { sanitizeEditorHtml } from '@/components/blog-editor/sanitize-editor-html';
import { useBlogEditorData } from '@/hooks/blog-editor/useBlogEditorData';
import { useBlogImageUpload } from '@/hooks/blog-editor/useBlogImageUpload';
import { useMerchant } from '@/hooks/useMerchant';
import { supabase } from '@/lib/supabase';
import { parseWebViewEditorMessage } from '@/lib/validators/storage';

interface UseBlogEditorOptions {
  id: string | string[] | undefined;
  webViewRef: RefObject<WebView | null>;
}

export function useBlogEditor({ id, webViewRef }: UseBlogEditorOptions) {
  const postId = normalizeBlogPostId(id);
  const [isAIModalVisible, setIsAIModalVisible] = useState(false);
  const [isLinkModalVisible, setIsLinkModalVisible] = useState(false);
  const [isVideoModalVisible, setIsVideoModalVisible] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [aiInstruction, setAiInstruction] = useState('');
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [isSaveRequested, setIsSaveRequested] = useState(false);
  const { isLoading: isMerchantLoading, merchant } = useMerchant();
  const merchantId = merchant?.id ?? null;
  const {
    content,
    errorMessage,
    initialEditorContent,
    isLoading,
    isSaving: isPersistingContent,
    retryLoad,
    saveContent,
    setContent,
  } = useBlogEditorData({
    isMerchantLoading,
    merchantId,
    onSaveSuccess: () => router.back(),
    postId,
  });
  const { handleImagePick, isUploadingImage } = useBlogImageUpload({
    webViewRef,
  });

  const handleSave = () => {
    const editorWebView = webViewRef.current;

    if (!editorWebView) {
      Alert.alert(
        'Editor unavailable',
        'Please wait for the editor to finish loading.'
      );
      return;
    }

    setIsSaveRequested(true);
    try {
      editorWebView.injectJavaScript(buildSaveRequestScript());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', message);
      setIsSaveRequested(false);
    }
  };

  const processAIRequest = async (currentHtml: string) => {
    try {
      const sanitizedHtml = sanitizeEditorHtml(currentHtml);

      if (!sanitizedHtml.trim()) {
        Alert.alert('Empty', 'Write some content first!');
        setIsAIProcessing(false);
        return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error(sessionError?.message || 'No session');
      }

      const nextContent = await requestBlogEditorAiEdit({
        accessToken: session.access_token,
        apiUrl: process.env.EXPO_PUBLIC_API_URL || '',
        content: sanitizedHtml,
        instruction: aiInstruction,
      });
      const nextEditorContent = sanitizeEditorHtml(nextContent);
      const escapedContent = JSON.stringify(nextEditorContent);
      const editorWebView = webViewRef.current;

      if (!editorWebView) {
        throw new Error('Editor unavailable');
      }

      editorWebView.injectJavaScript(`
        document.getElementById('editor').innerHTML = ${escapedContent};
        true;
      `);
      setContent(nextEditorContent);

      Alert.alert('Success', 'Content has been polished by AI!');
      setAiInstruction('');
    } catch (error: unknown) {
      console.error(error);
      Alert.alert('AI Error', (error as Error).message);
    } finally {
      setIsAIProcessing(false);
    }
  };

  const onWebViewMessage = (event: { nativeEvent: { data: string } }) => {
    const message = parseWebViewEditorMessage(event.nativeEvent.data);
    if (!message) {
      console.error('WebView message parse error: invalid message format');
      return;
    }

    switch (message.type) {
      case 'save':
        setIsSaveRequested(false);
        void saveContent(message.content).catch((error: unknown) => {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          Alert.alert('Error', errorMessage);
        });
        break;
      case 'ai_request':
        void processAIRequest(message.content);
        break;
      case 'content_change':
        setContent(sanitizeEditorHtml(message.content));
        break;
    }
  };

  const handleInsertLink = () => {
    if (!linkUrl.trim()) {
      return;
    }

    const normalizedUrl = linkUrl.startsWith('http')
      ? linkUrl
      : `https://${linkUrl}`;
    webViewRef.current?.injectJavaScript(buildCreateLinkScript(normalizedUrl));
    setLinkUrl('');
    setIsLinkModalVisible(false);
  };

  const handleInsertVideo = () => {
    setIsVideoModalVisible(true);
  };

  const confirmInsertVideo = () => {
    if (!videoUrl.trim()) {
      return;
    }

    const editorWebView = webViewRef.current;

    if (!editorWebView) {
      Alert.alert(
        'Editor unavailable',
        'Please wait for the editor to finish loading.'
      );
      return;
    }

    const insertScript = buildInsertVideoScript(videoUrl);

    if (insertScript === 'true;') {
      Alert.alert('Invalid video', 'Enter a valid YouTube URL or video ID.');
      return;
    }

    editorWebView.injectJavaScript(insertScript);
    setVideoUrl('');
    setIsVideoModalVisible(false);
  };

  const formatAction = (command: FormatCommand, value?: string) => {
    webViewRef.current?.injectJavaScript(
      buildFormatActionScript(command, value)
    );
  };

  const handleInsertTable = (rows = 2, cols = 2) => {
    webViewRef.current?.injectJavaScript(buildInsertTableScript(rows, cols));
  };

  return {
    aiInstruction,
    closeAIModal: () => setIsAIModalVisible(false),
    closeLinkModal: () => setIsLinkModalVisible(false),
    closeVideoModal: () => {
      setVideoUrl('');
      setIsVideoModalVisible(false);
    },
    confirmInsertVideo,
    content,
    errorMessage,
    formatAction,
    handleImagePick,
    handleInsertLink,
    handleInsertTable,
    handleInsertVideo,
    handleSave,
    initialEditorContent,
    isAIModalVisible,
    isAIProcessing,
    isLinkModalVisible,
    isLoading,
    isSaving: isSaveRequested || isPersistingContent,
    isUploadingImage,
    isVideoModalVisible,
    linkUrl,
    onWebViewMessage,
    openAIModal: () => setIsAIModalVisible(true),
    openLinkModal: () => setIsLinkModalVisible(true),
    requestAIEdit: () => {
      const editorWebView = webViewRef.current;

      if (!editorWebView) {
        Alert.alert(
          'Editor unavailable',
          'Please wait for the editor to finish loading.'
        );
        return;
      }

      setIsAIModalVisible(false);
      setIsAIProcessing(true);

      try {
        editorWebView.injectJavaScript(buildAiRequestScript());
      } catch (error: unknown) {
        setIsAIProcessing(false);
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        Alert.alert('Error', message);
      }
    },
    retryLoad,
    setAiInstruction,
    setLinkUrl,
    setVideoUrl,
    videoUrl,
  };
}
