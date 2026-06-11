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

async function loadBlogContent(
  postId: string,
  merchantId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('content')
    .eq('id', postId)
    .eq('merchant_id', merchantId)
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to load content');
  }

  return sanitizeEditorHtml(data.content || '');
}

async function persistBlogContent(
  postId: string | null,
  merchantId: string | null,
  html: string
): Promise<string> {
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

  return sanitizedHtml;
}

export function useBlogEditorData({
  isMerchantLoading,
  merchantId,
  onSaveSuccess,
  postId,
}: UseBlogEditorDataOptions) {
  const [content, setContent] = useState('');
  const [initialEditorContent, setInitialEditorContent] = useState('');
  const [isLoading, setIsLoading] = useState(
    () => Boolean(postId) && (isMerchantLoading || Boolean(merchantId))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (!postId) {
      return 'Missing blog post id';
    }

    if (!isMerchantLoading && !merchantId) {
      return 'Missing merchant id';
    }

    return null;
  });
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [prevInputs, setPrevInputs] = useState({
    isMerchantLoading,
    merchantId,
    postId,
    reloadKey,
  });

  if (
    prevInputs.isMerchantLoading !== isMerchantLoading ||
    prevInputs.merchantId !== merchantId ||
    prevInputs.postId !== postId ||
    prevInputs.reloadKey !== reloadKey
  ) {
    setPrevInputs({ isMerchantLoading, merchantId, postId, reloadKey });

    if (!postId) {
      setContent('');
      setInitialEditorContent('');
      setErrorMessage('Missing blog post id');
      setIsLoading(false);
    } else if (isMerchantLoading) {
      setContent('');
      setInitialEditorContent('');
      setErrorMessage(null);
      setIsLoading(true);
    } else if (!merchantId) {
      setContent('');
      setInitialEditorContent('');
      setErrorMessage('Missing merchant id');
      setIsLoading(false);
    } else {
      setErrorMessage(null);
      setIsLoading(true);
    }
  }

  useEffect(() => {
    if (!postId || isMerchantLoading || !merchantId) {
      return;
    }

    void reloadKey;
    let isActive = true;

    loadBlogContent(postId, merchantId)
      .then((nextContent) => {
        if (!isActive) {
          return;
        }

        setContent(nextContent);
        setInitialEditorContent(nextContent);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (!isActive) {
          return;
        }

        setErrorMessage(getErrorMessage(error, 'Failed to load content'));
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [isMerchantLoading, merchantId, postId, reloadKey]);

  const saveContent = (html: string) => {
    setIsSaving(true);
    setSaveErrorMessage(null);

    return persistBlogContent(postId, merchantId, html)
      .then((sanitizedHtml) => {
        setContent(sanitizedHtml);
        setInitialEditorContent(sanitizedHtml);
        onSaveSuccess?.();
      })
      .catch((error: unknown) => {
        setSaveErrorMessage(getErrorMessage(error, 'Failed to save content'));
        throw error;
      })
      .finally(() => {
        setIsSaving(false);
      });
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
