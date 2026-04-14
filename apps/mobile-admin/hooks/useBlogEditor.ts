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
import { useMerchant } from '@/hooks/useMerchant';
import { supabase } from '@/lib/supabase';
import { parseWebViewEditorMessage } from '@/lib/validators/storage';

interface UseBlogEditorOptions {
  id: string | string[] | undefined;
  webViewRef: RefObject<WebView | null>;
}

export function useBlogEditor({ id, webViewRef }: UseBlogEditorOptions) {
  const postId = normalizeBlogPostId(id);
  const [content, setContent] = useState('');
  const [initialEditorContent, setInitialEditorContent] = useState('');
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
  const { isLoading: isMerchantLoading, merchant } = useMerchant();
  const merchantId = merchant?.id ?? null;

  useEffect(() => {
    void reloadKey;

    if (!postId) {
      setErrorMessage('Missing blog post id');
      setIsLoading(false);
      return;
    }

    if (isMerchantLoading) {
      setIsLoading(true);
      return;
    }

    if (!merchantId) {
      setErrorMessage('Missing merchant id');
      setIsLoading(false);
      return;
    }

    async function fetchContent() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const { data, error } = await supabase
          .from('blog_posts')
          .select('content')
          .eq('id', postId)
          .eq('merchant_id', merchantId)
          .single();

        if (error || !data) {
          throw error ?? new Error('Failed to load content');
        }

        const nextContent = sanitizeEditorHtml(data.content || '');

        setContent(nextContent);
        setInitialEditorContent(nextContent);
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to load content'
        );
      } finally {
        setIsLoading(false);
      }
    }

    void fetchContent();
  }, [isMerchantLoading, merchantId, postId, reloadKey]);

  const handleSave = () => {
    const editorWebView = webViewRef.current;

    if (!editorWebView) {
      Alert.alert(
        'Editor unavailable',
        'Please wait for the editor to finish loading.'
      );
      return;
    }

    setIsSaving(true);
    try {
      editorWebView.injectJavaScript(buildSaveRequestScript());
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

    if (!merchantId) {
      Alert.alert('Error', 'Missing merchant id');
      setIsSaving(false);
      return;
    }

    const sanitizedHtml = sanitizeEditorHtml(html);

    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .update({
          content: sanitizedHtml,
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId)
        .eq('merchant_id', merchantId)
        .select('id')
        .single();

      if (error || !data) {
        throw error ?? new Error('Failed to save content');
      }

      setContent(sanitizedHtml);
      setInitialEditorContent(sanitizedHtml);
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
    initialEditorContent,
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
      } catch (error) {
        setIsAIProcessing(false);
        Alert.alert('Error', (error as Error).message);
      }
    },
    closeAIModal: () => setIsAIModalVisible(false),
    closeLinkModal: () => setIsLinkModalVisible(false),
    formatAction,
    retryLoad: () => setReloadKey((currentKey) => currentKey + 1),
    setAiInstruction,
    setLinkUrl,
  };
}
