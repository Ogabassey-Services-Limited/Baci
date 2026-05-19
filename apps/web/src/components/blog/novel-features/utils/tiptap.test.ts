import { describe, it, expect } from 'vitest';
import { getTiptap } from './tiptap';

describe('tiptap utils', () => {
  describe('getTiptap', () => {
    it('returns null when editor is undefined', () => {
      expect(getTiptap(undefined)).toBeNull();
    });

    it('returns null when editor is null', () => {
      expect(getTiptap(null)).toBeNull();
    });

    it('returns the casted editor when editor is provided', () => {
      const mockEditor = { someProperty: 'test' };
      expect(getTiptap(mockEditor)).toBe(mockEditor);
    });
  });
});
