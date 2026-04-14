import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  requestBlogEditorAiEdit,
  uploadBlogEditorImage,
} from '@/components/blog-editor/blog-editor-api';

vi.mock('@/types/upload', () => ({
  asUploadFile: (value: unknown) => value,
}));

describe('blog-editor-api', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns AI-edited content on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ content: '<p>Updated</p>' }), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        })
      )
    );

    await expect(
      requestBlogEditorAiEdit({
        accessToken: 'token',
        apiUrl: 'https://api.usebaci.com',
        content: '<p>Hello</p>',
        instruction: 'Make it warmer',
      })
    ).resolves.toBe('<p>Updated</p>');
  });

  it('returns an uploaded image URL on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ url: 'https://cdn.usebaci.com/image.png' }),
          {
            headers: { 'content-type': 'application/json' },
            status: 200,
          }
        )
      )
    );

    await expect(
      uploadBlogEditorImage({
        accessToken: 'token',
        apiUrl: 'https://api.usebaci.com',
        asset: {
          fileName: 'hero.png',
          mimeType: 'image/png',
          uri: 'file:///hero.png',
        },
      })
    ).resolves.toBe('https://cdn.usebaci.com/image.png');
  });

  it('surfaces upload API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Upload failed' }), {
          headers: { 'content-type': 'application/json' },
          status: 500,
        })
      )
    );

    await expect(
      uploadBlogEditorImage({
        accessToken: 'token',
        apiUrl: 'https://api.usebaci.com',
        asset: {
          fileName: 'hero.png',
          mimeType: 'image/png',
          uri: 'file:///hero.png',
        },
      })
    ).rejects.toThrow('Upload failed (500): Upload failed');
  });

  it('surfaces server-side API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Gateway timeout' }), {
          headers: { 'content-type': 'application/json' },
          status: 504,
        })
      )
    );

    await expect(
      requestBlogEditorAiEdit({
        accessToken: 'token',
        apiUrl: 'https://api.usebaci.com',
        content: '<p>Hello</p>',
        instruction: 'Retry',
      })
    ).rejects.toThrow('AI edit failed (504): Gateway timeout');
  });

  it('surfaces network-level AI edit failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network request failed'))
    );

    await expect(
      requestBlogEditorAiEdit({
        accessToken: 'token',
        apiUrl: 'https://api.usebaci.com',
        content: '<p>Hello</p>',
        instruction: 'Retry',
      })
    ).rejects.toThrow('Network request failed');
  });
});
