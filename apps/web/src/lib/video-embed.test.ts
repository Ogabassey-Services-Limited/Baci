import { describe, expect, it } from 'vitest';
import { getVideoEmbedUrl } from './video-embed';

describe('getVideoEmbedUrl', () => {
  describe('YouTube', () => {
    it('converts a youtube.com watch URL to nocookie embed', () => {
      expect(
        getVideoEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      ).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    });

    it('converts a youtube.com watch URL without www', () => {
      expect(getVideoEmbedUrl('https://youtube.com/watch?v=9bZkp7q19f0')).toBe(
        'https://www.youtube-nocookie.com/embed/9bZkp7q19f0'
      );
    });

    it('converts a youtu.be short link', () => {
      expect(getVideoEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
      );
    });

    it('passes through an already-embed youtube-nocookie URL', () => {
      const url = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ';
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

    it('converts a www.vimeo.com share URL to player embed', () => {
      expect(getVideoEmbedUrl('https://www.vimeo.com/123456789')).toBe(
        'https://player.vimeo.com/video/123456789'
      );
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

    it('returns null for http: protocol', () => {
      expect(getVideoEmbedUrl('http://www.youtube.com/watch?v=abc')).toBeNull();
    });

    it('rejects subdomain spoofing attempts', () => {
      expect(
        getVideoEmbedUrl('https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ')
      ).toBeNull();
      expect(
        getVideoEmbedUrl('https://www.youtube.com.evil.com/watch?v=dQw4w9WgXcQ')
      ).toBeNull();
    });

    it('rejects YouTube IDs that do not match the 11-char pattern', () => {
      expect(
        getVideoEmbedUrl('https://www.youtube.com/watch?v=<script>')
      ).toBeNull();
      expect(getVideoEmbedUrl('https://youtu.be/../../etc')).toBeNull();
    });

    it('rejects non-watch YouTube paths', () => {
      expect(
        getVideoEmbedUrl('https://www.youtube.com/channel/UCxyz')
      ).toBeNull();
      expect(
        getVideoEmbedUrl('https://www.youtube.com/playlist?list=abc')
      ).toBeNull();
    });

    it('rejects invalid youtube-nocookie.com paths', () => {
      expect(
        getVideoEmbedUrl('https://www.youtube-nocookie.com/watch?v=dQw4w9WgXcQ')
      ).toBeNull();
      expect(
        getVideoEmbedUrl('https://www.youtube-nocookie.com/channel/UCxyz')
      ).toBeNull();
    });

    it('rejects invalid player.vimeo.com paths', () => {
      expect(getVideoEmbedUrl('https://player.vimeo.com/channels')).toBeNull();
    });
  });
});
