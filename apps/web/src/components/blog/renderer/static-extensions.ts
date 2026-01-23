import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Image as TiptapImage } from '@tiptap/extension-image';
import { Link as TiptapLink } from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Typography } from '@tiptap/extension-typography';
import { StarterKit } from '@tiptap/starter-kit';

/**
 * SSR-safe extensions for TipTap content processing.
 * These do not contain any browser-only logic (window, document, etc.)
 */
export const blogStaticExtensions = [
  StarterKit,
  TiptapImage.configure({
    HTMLAttributes: {
      class: 'rounded-2xl shadow-lg border border-border/50 my-8',
    },
  }),
  TiptapLink.configure({
    HTMLAttributes: {
      class:
        'text-primary underline underline-offset-4 decoration-primary/30 transition-colors hover:text-primary/80',
    },
  }),
  Table.configure({
    resizable: true,
  }),
  TableCell,
  TableHeader,
  TableRow,
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  TaskItem,
  TaskList,
  Typography,
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
];
