import { describe, expect, it } from 'vitest';
import {
  normalizeBlogPostId,
  readEditorApiError,
} from '@/components/blog-editor/blog-editor-helpers';

describe('blog-editor-helpers', () => {
  it('normalizes route params to a single post id', () => {
    expect(normalizeBlogPostId('post-1')).toBe('post-1');
    expect(normalizeBlogPostId(['post-2', 'post-3'])).toBe('post-2');
    expect(normalizeBlogPostId(undefined)).toBeNull();
  });

  it('reads JSON API errors when the response body is JSON', async () => {
    const response = new Response(JSON.stringify({ error: 'Request failed' }), {
      headers: { 'content-type': 'application/json' },
      status: 422,
    });

    await expect(readEditorApiError(response, 'AI edit failed')).resolves.toBe(
      'AI edit failed (422): Request failed'
    );
  });

  it('falls back to text responses when JSON is unavailable', async () => {
    const response = new Response('Temporary outage', { status: 503 });

    await expect(readEditorApiError(response, 'Upload failed')).resolves.toBe(
      'Upload failed (503): Temporary outage'
    );
  });

  it('falls back when the response body is empty', async () => {
    const response = new Response(null, { status: 204 });

    await expect(readEditorApiError(response, 'Upload failed')).resolves.toBe(
      'Upload failed (204)'
    );
  });

  it('falls back when JSON omits a usable error field', async () => {
    const response = new Response(JSON.stringify({ message: 'oops' }), {
      headers: { 'content-type': 'application/json' },
      status: 400,
    });

    await expect(readEditorApiError(response, 'AI edit failed')).resolves.toBe(
      'AI edit failed (400)'
    );
  });
});
