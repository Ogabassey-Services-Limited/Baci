import { describe, expect, it } from 'vitest';
import { getVideoEmbedUrl } from './video-embed';

describe('getVideoEmbedUrl', () => {
  describe('YouTube', () => {
    it('converts a youtube.com watch URL to nocookie embed', () => {
      expect(getVideoEmbedUrl('https://www.youtube.com/watch?v=abc123')).toBe(
        'https://www.youtube-nocookie.com/embed/abc123'
      );
    });

    it('converts a youtube.com watch URL without www', () => {
      expect(getVideoEmbedUrl('https://youtube.com/watch?v=xyz')).toBe(
        'https://www.youtube-nocookie.com/embed/xyz'
      );
    });

    it('converts a youtu.be short link', () => {
      expect(getVideoEmbedUrl('https://youtu.be/abc123')).toBe(
        'https://www.youtube-nocookie.com/embed/abc123'
      );
    });

    it('passes through an already-embed youtube-nocookie URL', () => {
      const url = 'https://www.youtube-nocookie.com/embed/abc123';
      expect(getVideoEmbedUrl(url)).toBe(url);
    });

    it('returns null for youtube watch URL without v param', () => {
      expect(getVideoEmbedUrl('https://www.youtube.com/watch')).toBeNull();
    });

    it('returns null for empty youtu.be path', () => {
      expect(getVideoEmbedUrl('https://youtu.be/')).toBeNull();
    });
  });

  describe('Vimeo', () => {
    it('converts a vimeo.com share URL to player embed', () => {
      expect(getVideoEmbedUrl('https://vimeo.com/123456789')).toBe(
        'https://player.vimeo.com/video/123456789'
      );
    });

    it('passes through a player.vimeo.com URL', () => {
      const url = 'https://player.vimeo.com/video/123456789';
      expect(getVideoEmbedUrl(url)).toBe(url);
    });

    it('returns null for non-numeric vimeo paths', () => {
      expect(getVideoEmbedUrl('https://vimeo.com/channels')).toBeNull();
    });
  });

  describe('rejection', () => {
    it('returns null for disallowed hosts', () => {
      expect(getVideoEmbedUrl('https://evil.com/video')).toBeNull();
    });

    it('returns null for javascript: protocol', () => {
      expect(getVideoEmbedUrl('javascript:alert(1)')).toBeNull();
    });

    it('returns null for malformed URLs', () => {
      expect(getVideoEmbedUrl('not-a-url')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(getVideoEmbedUrl('')).toBeNull();
    });

    it('returns null for data: protocol', () => {
      expect(getVideoEmbedUrl('data:text/html,<h1>hi</h1>')).toBeNull();
    });
  });
});
