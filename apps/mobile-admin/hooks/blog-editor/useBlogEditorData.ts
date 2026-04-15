import { useEffect, useState } from 'react';
import { sanitizeEditorHtml } from '@/components/blog-editor/sanitize-editor-html';
import { supabase } from '@/lib/supabase';

interface UseBlogEditorDataOptions {
  isMerchantLoading: boolean;
  merchantId: string | null;
  onSaveSuccess?: () => void;
  postId: string | null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
}

export function useBlogEditorData({
  isMerchantLoading,
  merchantId,
  onSaveSuccess,
  postId,
}: UseBlogEditorDataOptions) {
  const [content, setContent] = useState('');
  const [initialEditorContent, setInitialEditorContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isActive = true;
    void reloadKey;

    if (!postId) {
      setContent('');
      setInitialEditorContent('');
      setErrorMessage('Missing blog post id');
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    if (isMerchantLoading) {
      setContent('');
      setInitialEditorContent('');
      setErrorMessage(null);
      setIsLoading(true);
      return () => {
        isActive = false;
      };
    }

    if (!merchantId) {
      setContent('');
      setInitialEditorContent('');
      setErrorMessage('Missing merchant id');
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    async function fetchContent(validPostId: string, validMerchantId: string) {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const { data, error } = await supabase
          .from('blog_posts')
          .select('content')
          .eq('id', validPostId)
          .eq('merchant_id', validMerchantId)
          .single();

        if (error || !data) {
          throw error ?? new Error('Failed to load content');
        }

        const nextContent = sanitizeEditorHtml(data.content || '');

        if (!isActive) {
          return;
        }

        setContent(nextContent);
        setInitialEditorContent(nextContent);
      } catch (error) {
        console.error(error);
        if (!isActive) {
          return;
        }
        setErrorMessage(getErrorMessage(error, 'Failed to load content'));
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void fetchContent(postId, merchantId);

    return () => {
      isActive = false;
    };
  }, [isMerchantLoading, merchantId, postId, reloadKey]);

  const saveContent = async (html: string) => {
    setIsSaving(true);
    setSaveErrorMessage(null);

    try {
      if (!postId) {
        throw new Error('Missing blog post id');
      }

      if (!merchantId) {
        throw new Error('Missing merchant id');
      }

      const sanitizedHtml = sanitizeEditorHtml(html);
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
      onSaveSuccess?.();
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to save content');
      setSaveErrorMessage(message);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    content,
    errorMessage,
    initialEditorContent,
    isLoading,
    isSaving,
    retryLoad: () => setReloadKey((currentKey) => currentKey + 1),
    saveErrorMessage,
    saveContent,
    setContent,
  };
}
