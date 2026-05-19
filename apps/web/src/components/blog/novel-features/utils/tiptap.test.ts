import { describe, expect, it } from 'vitest';
import { getTiptap, isTiptapEditor } from './tiptap';

describe('tiptap utils', () => {
  describe('getTiptap', () => {
    it('returns null when editor is undefined', () => {
      expect(getTiptap(undefined)).toBeNull();
    });

    it('returns null when editor is null', () => {
      expect(getTiptap(null)).toBeNull();
    });

    it('returns null when the editor object is missing required methods', () => {
      expect(getTiptap({ someProperty: 'test' })).toBeNull();
    });

    it('returns the editor when the runtime shape matches Tiptap requirements', () => {
      const mockEditor = {
        isActive: () => false,
        getAttributes: () => ({}),
        chain: () => ({ focus: () => ({ run: () => undefined }) }),
        can: () => ({
          chain: () => ({
            focus: () => ({
              run: () => true,
              undo: () => ({ run: () => true }),
              redo: () => ({ run: () => true }),
            }),
          }),
        }),
        commands: {
          setYoutubeVideo: () => undefined,
        },
        state: {
          selection: {
            from: 1,
          },
        },
        view: {},
      };

      expect(getTiptap(mockEditor)).toBe(mockEditor);
      expect(isTiptapEditor(mockEditor)).toBe(true);
    });
  });
});
