import type { EditorView } from 'prosemirror-view';

interface TiptapCommandChain {
  run: () => void;
  toggleBold: () => TiptapCommandChain;
  toggleItalic: () => TiptapCommandChain;
  toggleUnderline: () => TiptapCommandChain;
  toggleStrike: () => TiptapCommandChain;
  toggleCode: () => TiptapCommandChain;
  setTextAlign: (alignment: string) => TiptapCommandChain;
  toggleBlockquote: () => TiptapCommandChain;
  setHorizontalRule: () => TiptapCommandChain;
  toggleSuperscript: () => TiptapCommandChain;
  toggleSubscript: () => TiptapCommandChain;
  setImage: (options: {
    src: string;
    title?: string | null;
    alt?: string | null;
  }) => TiptapCommandChain;
  updateAttributes: (
    typeOrName: string,
    attributes: Record<string, unknown>
  ) => TiptapCommandChain;
  insertTable: (options: {
    rows: number;
    cols: number;
    withHeaderRow: boolean;
  }) => TiptapCommandChain;
  undo: () => TiptapCommandChain;
  redo: () => TiptapCommandChain;
  toggleTaskList: () => TiptapCommandChain;
  toggleBulletList: () => TiptapCommandChain;
  toggleOrderedList: () => TiptapCommandChain;
  toggleNode: (
    typeOrName: string,
    attributes?: string | Record<string, unknown>
  ) => TiptapCommandChain;
  toggleHeading: (options: { level: number }) => TiptapCommandChain;
  toggleCodeBlock: () => TiptapCommandChain;
}

interface TiptapCanCommandChain {
  run: () => boolean;
  focus: () => TiptapCanCommandChain;
  undo: () => TiptapCanCommandChain;
  redo: () => TiptapCanCommandChain;
}

// Unified TiptapEditor interface combining requirements from toolbar and node selector
export interface TiptapEditor {
  isActive: (
    name: string | Record<string, unknown>,
    options?: Record<string, unknown>
  ) => boolean;
  getAttributes: <T extends object = Record<string, unknown>>(
    name: string
  ) => T;
  chain: () => {
    focus: () => TiptapCommandChain;
  };
  can: () => {
    chain: () => TiptapCanCommandChain;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isTiptapEditor(editor: unknown): editor is TiptapEditor {
  if (!isRecord(editor)) {
    return false;
  }

  if (
    typeof editor.isActive !== 'function' ||
    typeof editor.getAttributes !== 'function' ||
    typeof editor.chain !== 'function' ||
    typeof editor.can !== 'function'
  ) {
    return false;
  }

  if (!isRecord(editor.commands)) {
    return false;
  }

  if (typeof editor.commands.setYoutubeVideo !== 'function') {
    return false;
  }

  if (!isRecord(editor.state) || !isRecord(editor.state.selection)) {
    return false;
  }

  return (
    typeof editor.state.selection.from === 'number' && isRecord(editor.view)
  );
}

export function getTiptap(editor: unknown): TiptapEditor | null {
  return isTiptapEditor(editor) ? editor : null;
}
