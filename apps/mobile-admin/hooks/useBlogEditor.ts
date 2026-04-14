import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { type RefObject, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import type { WebView } from 'react-native-webview';
import {
  requestBlogEditorAiEdit,
  uploadBlogEditorImage,
} from '@/components/blog-editor/blog-editor-api';
import {
  buildAiRequestScript,
  buildCreateLinkScript,
  buildFormatActionScript,
  buildInsertImageScript,
  buildInsertTableScript,
  buildInsertVideoScript,
  buildSaveRequestScript,
  type FormatCommand,
} from '@/components/blog-editor/blog-editor-commands';
import { normalizeBlogPostId } from '@/components/blog-editor/blog-editor-helpers';
import { sanitizeEditorHtml } from '@/components/blog-editor/sanitize-editor-html';
import { supabase } from '@/lib/supabase';
import { parseWebViewEditorMessage } from '@/lib/validators/storage';

interface UseBlogEditorOptions {
  id: string | string[] | undefined;
  webViewRef: RefObject<WebView | null>;
}

export function useBlogEditor({ id, webViewRef }: UseBlogEditorOptions) {
  const postId = normalizeBlogPostId(id);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [isAIModalVisible, setIsAIModalVisible] = useState(false);
  const [isLinkModalVisible, setIsLinkModalVisible] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [aiInstruction, setAiInstruction] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    void reloadKey;

    async function fetchContent() {
      if (!postId) {
        setErrorMessage('Missing blog post id');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const { data, error } = await supabase
          .from('blog_posts')
          .select('content')
          .eq('id', postId)
          .single();
        if (error) {
          throw error;
        }
        setContent(data.content || '');
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to load content'
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchContent();
  }, [postId, reloadKey]);

  const handleSave = () => {
    setIsSaving(true);
    try {
      webViewRef.current?.injectJavaScript(buildSaveRequestScript());
    } catch (error: unknown) {
      Alert.alert('Error', (error as Error).message);
      setIsSaving(false);
    }
  };

  const saveContent = async (html: string) => {
    if (!postId) {
      Alert.alert('Error', 'Missing blog post id');
      setIsSaving(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('blog_posts')
        .update({
          content: sanitizeEditorHtml(html),
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId);

      if (error) {
        throw error;
      }

      router.back();
    } catch (error: unknown) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setIsSaving(false);
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
      const escapedContent = JSON.stringify(nextContent);
      webViewRef.current?.injectJavaScript(`
        document.getElementById('editor').innerHTML = ${escapedContent};
        true;
      `);

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
        saveContent(message.content);
        break;
      case 'ai_request':
        processAIRequest(message.content);
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

  const formatAction = (command: FormatCommand, value?: string) => {
    webViewRef.current?.injectJavaScript(
      buildFormatActionScript(command, value)
    );
  };

  const handleInsertTable = () => {
    webViewRef.current?.injectJavaScript(buildInsertTableScript());
  };

  const handleInsertVideo = () => {
    Alert.prompt('Insert YouTube Video', 'Enter the YouTube video URL or ID', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Insert',
        onPress: (url?: string) => {
          if (!url) {
            return;
          }
          webViewRef.current?.injectJavaScript(buildInsertVideoScript(url));
        },
      },
    ]);
  };

  const handleImagePick = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photos'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }
      setIsUploadingImage(true);
      const asset = result.assets[0];

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error(sessionError?.message || 'No session');
      }

      const uploadedUrl = await uploadBlogEditorImage({
        accessToken: session.access_token,
        apiUrl: process.env.EXPO_PUBLIC_API_URL || '',
        asset,
      });

      webViewRef.current?.injectJavaScript(buildInsertImageScript(uploadedUrl));
    } catch (error: unknown) {
      console.error('[ImagePick] Upload error:', error);
      Alert.alert('Upload Failed', (error as Error).message || 'Unknown error');
    } finally {
      setIsUploadingImage(false);
    }
  };

  return {
    aiInstruction,
    content,
    handleImagePick,
    handleInsertLink,
    handleInsertTable,
    handleInsertVideo,
    handleSave,
    errorMessage,
    isAIModalVisible,
    isAIProcessing,
    isLinkModalVisible,
    isLoading,
    isSaving,
    isUploadingImage,
    linkUrl,
    onWebViewMessage,
    openAIModal: () => setIsAIModalVisible(true),
    openLinkModal: () => setIsLinkModalVisible(true),
    requestAIEdit: () => {
      setIsAIModalVisible(false);
      setIsAIProcessing(true);
      webViewRef.current?.injectJavaScript(buildAiRequestScript());
    },
    closeAIModal: () => setIsAIModalVisible(false),
    closeLinkModal: () => setIsLinkModalVisible(false),
    formatAction,
    retryLoad: () => setReloadKey((currentKey) => currentKey + 1),
    setAiInstruction,
    setLinkUrl,
  };
}
