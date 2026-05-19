import type { EditorView } from 'prosemirror-view';

// Unified TiptapEditor interface combining requirements from toolbar and node selector
export interface TiptapEditor {
  isActive: (
    name: string | Record<string, unknown>,
    options?: Record<string, unknown>
  ) => boolean;
  getAttributes: (name: string) => Record<string, unknown>;
  chain: () => {
    focus: () => {
      // Toolbar commands
      toggleBold: () => { run: () => void };
      toggleItalic: () => { run: () => void };
      toggleUnderline: () => { run: () => void };
      toggleStrike: () => { run: () => void };
      toggleCode: () => { run: () => void };
      setTextAlign: (alignment: string) => { run: () => void };
      toggleBlockquote: () => { run: () => void };
      setHorizontalRule: () => { run: () => void };
      toggleSuperscript: () => { run: () => void };
      toggleSubscript: () => { run: () => void };
      setImage: (options: { src: string; title?: string | null }) => {
        run: () => void;
      };
      updateAttributes: (
        typeOrName: string,
        attributes: Record<string, unknown>
      ) => { run: () => void };
      insertTable: (options: {
        rows: number;
        cols: number;
        withHeaderRow: boolean;
      }) => { run: () => void };
      undo: () => { run: () => void };
      redo: () => { run: () => void };

      // Node Selector commands
      toggleTaskList: () => { run: () => void };
      toggleBulletList: () => { run: () => void };
      toggleOrderedList: () => { run: () => void };
      toggleNode: (
        typeOrName: string,
        attributes?: string | Record<string, unknown>
      ) => {
        run: () => void;
        toggleBlockquote: () => { run: () => void };
      };
      toggleHeading: (options: { level: number }) => { run: () => void };
      toggleCodeBlock: () => { run: () => void };
    };
  };
  can: () => {
    chain: () => {
      focus: () => {
        undo: () => { run: () => boolean };
        redo: () => { run: () => boolean };
      };
    };
  };
  commands: {
    setYoutubeVideo: (options: { src: string }) => void;
  };
  state: {
    selection: {
      from: number;
    };
  };
  view: EditorView;
}

export function getTiptap(editor: unknown): TiptapEditor | null {
  if (!editor) return null;
  return editor as unknown as TiptapEditor;
}
