import { readEditorApiError } from '@/components/blog-editor/blog-editor-helpers';
import { asUploadFile } from '@/types/upload';

interface RequestBlogEditorAiEditOptions {
  accessToken: string;
  apiUrl: string;
  content: string;
  instruction: string;
}

interface UploadBlogEditorImageOptions {
  accessToken: string;
  apiUrl: string;
  asset: {
    fileName?: string | null;
    mimeType?: string | null;
    uri: string;
  };
}

export async function requestBlogEditorAiEdit({
  accessToken,
  apiUrl,
  content,
  instruction,
}: RequestBlogEditorAiEditOptions): Promise<string> {
  const response = await fetch(`${apiUrl}/api/ai/edit-blog`, {
    body: JSON.stringify({ content, instruction }),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(await readEditorApiError(response, 'AI edit failed'));
  }

  const data = await response.json();
  if (typeof data?.content !== 'string') {
    throw new Error('AI edit failed: response did not include content');
  }

  return data.content;
}

export async function uploadBlogEditorImage({
  accessToken,
  apiUrl,
  asset,
}: UploadBlogEditorImageOptions): Promise<string> {
  const formData = new FormData();
  formData.append(
    'file',
    asUploadFile({
      name: asset.fileName || `image-${Date.now()}.png`,
      type: asset.mimeType || 'image/png',
      uri: asset.uri,
    })
  );

  const response = await fetch(`${apiUrl}/api/merchant/blog/upload`, {
    body: formData,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(await readEditorApiError(response, 'Upload failed'));
  }

  const data = await response.json();
  if (typeof data?.url !== 'string' || data.url.length === 0) {
    throw new Error('No URL returned from upload API');
  }

  return data.url;
}
