'use client';

import {
  Grid,
  Link as LinkIcon,
  ShoppingBag,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Youtube as YoutubeIcon,
} from 'lucide-react';
import { useEditor } from 'novel';
import type { ImageUploadHandler } from '@/components/blog/novel-features/slash-command';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { sanitizeUrl } from '@/lib/sanitize-core';
import { cn } from '@/lib/utils';
import { getTiptap } from '../utils/tiptap';
import { EditorFormatControls } from './editor-format-controls';
import { EditorImageControls } from './editor-image-controls';

interface EditorToolbarProps {
  onImageUpload?: ImageUploadHandler;
  onOpenLink?: () => void;
  onOpenProducts?: () => void;
}

export const EditorToolbar = ({
  onImageUpload,
  onOpenLink,
  onOpenProducts,
}: EditorToolbarProps) => {
  const { editor } = useEditor();
  if (!editor) return null;
  const tiptap = getTiptap(editor);

  return (
    <div className="flex flex-wrap items-center gap-1 p-1 border-b bg-background sticky top-0 z-10 sm:rounded-t-lg">
      <EditorFormatControls editor={editor} />
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={onOpenLink}
          className={cn('size-8 p-0', {
            'bg-accent text-accent-foreground': tiptap?.isActive('link'),
          })}
          title="Hyperlink"
        >
          <LinkIcon className="size-4" />
        </Button>
        <EditorImageControls editor={editor} onImageUpload={onImageUpload} />
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() =>
            tiptap
              ?.chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
          className="size-8 p-0"
          title="Insert Table"
        >
          <Grid className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => {
            const url = prompt('Enter YouTube URL');
            if (!url) return;
            const sanitized = sanitizeUrl(url.trim());
            if (sanitized) {
              tiptap?.commands.setYoutubeVideo({ src: sanitized });
              return;
            }
            alert('Invalid YouTube URL. Please enter a valid https:// URL.');
          }}
          className="size-8 p-0"
          title="Insert YouTube Video"
        >
          <YoutubeIcon className="size-4" />
        </Button>
        <div className="flex items-center gap-1 border-x px-1 mx-1">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => tiptap?.chain().focus().toggleSuperscript().run()}
            className={cn(
              'size-8 p-0',
              tiptap?.isActive('superscript') && 'bg-accent'
            )}
            title="Superscript"
          >
            <SuperscriptIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => tiptap?.chain().focus().toggleSubscript().run()}
            className={cn(
              'size-8 p-0',
              tiptap?.isActive('subscript') && 'bg-accent'
            )}
            title="Subscript"
          >
            <SubscriptIcon className="size-4" />
          </Button>
        </div>
        {onOpenProducts ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={onOpenProducts}
            className="size-8 p-0"
            title="Embed Products"
          >
            <ShoppingBag className="size-4" />
          </Button>
        ) : null}
      </div>
      <Separator orientation="vertical" className="mx-1 h-6" />
    </div>
  );
};
