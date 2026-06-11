import type { RefObject } from 'react';
import { Alert } from 'react-native';
import type { WebView } from 'react-native-webview';
import { requestBlogEditorAiEdit } from '@/components/blog-editor/blog-editor-api';
import { sanitizeEditorHtml } from '@/components/blog-editor/sanitize-editor-html';
import { getErrorMessage } from '@/hooks/useBlogEditor.helpers';
import { supabase } from '@/lib/supabase';

interface ProcessBlogEditorAiRequestOptions {
  aiInstruction: string;
  currentHtml: string;
  setAiInstruction: (instruction: string) => void;
  setContent: (content: string) => void;
  setIsAIProcessing: (isProcessing: boolean) => void;
  webViewRef: RefObject<WebView | null>;
}

/**
 * Runs the blog editor AI edit flow.
 *
 * Lives at module scope (not inside useBlogEditor) because the try/finally
 * and throw-inside-try statements are syntax React Compiler cannot lower
 * yet, which would bail the whole hook out of automatic memoization.
 */
export async function processBlogEditorAiRequest({
  aiInstruction,
  currentHtml,
  setAiInstruction,
  setContent,
  setIsAIProcessing,
  webViewRef,
}: ProcessBlogEditorAiRequestOptions): Promise<void> {
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
    Alert.alert('AI Error', getErrorMessage(error, 'Unknown error'));
  } finally {
    setIsAIProcessing(false);
  }
}
