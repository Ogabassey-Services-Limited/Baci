'use client';

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Grid,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  ShoppingBag,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Underline,
  Undo,
  Youtube as YoutubeIcon,
} from 'lucide-react';
import { useEditor } from 'novel';
import { useRef, useState } from 'react';
import { uploadFn } from '@/components/blog/novel-features/image-upload';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ColorSelector } from './color-selector';
import { NodeSelector } from './node-selector';

interface EditorToolbarProps {
  onOpenLink?: () => void;
  onOpenProducts?: () => void;
}

export const EditorToolbar = ({
  onOpenLink,
  onOpenProducts,
}: EditorToolbarProps) => {
  const { editor } = useEditor();
  const [openNode, setOpenNode] = useState(false);
  const [openColor, setOpenColor] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const formatButtons = [
    {
      name: 'bold',
      isActive: () => editor.isActive('bold'),
      command: () => editor.chain().focus().toggleBold().run(),
      icon: Bold,
      title: 'Bold (Cmd+B)',
    },
    {
      name: 'italic',
      isActive: () => editor.isActive('italic'),
      command: () => editor.chain().focus().toggleItalic().run(),
      icon: Italic,
      title: 'Italic (Cmd+I)',
    },
    {
      name: 'underline',
      isActive: () => editor.isActive('underline'),
      command: () => editor.chain().focus().toggleUnderline().run(),
      icon: Underline,
      title: 'Underline (Cmd+U)',
    },
    {
      name: 'strike',
      isActive: () => editor.isActive('strike'),
      command: () => editor.chain().focus().toggleStrike().run(),
      icon: Strikethrough,
      title: 'Strikethrough',
    },
    {
      name: 'code',
      isActive: () => editor.isActive('code'),
      command: () => editor.chain().focus().toggleCode().run(),
      icon: Code,
      title: 'Code Inline',
    },
  ];

  const alignmentButtons = [
    {
      name: 'left',
      isActive: () => editor.isActive({ textAlign: 'left' }),
      command: () =>
        // @ts-expect-error: TextAlign extension types not merging correctly
        editor
          .chain()
          .focus()
          .setTextAlign('left')
          .run(),
      icon: AlignLeft,
      title: 'Align Left',
    },
    {
      name: 'center',
      isActive: () => editor.isActive({ textAlign: 'center' }),
      command: () =>
        // @ts-expect-error: TextAlign extension types not merging correctly
        editor
          .chain()
          .focus()
          .setTextAlign('center')
          .run(),
      icon: AlignCenter,
      title: 'Align Center',
    },
    {
      name: 'right',
      isActive: () => editor.isActive({ textAlign: 'right' }),
      command: () =>
        // @ts-expect-error: TextAlign extension types not merging correctly
        editor
          .chain()
          .focus()
          .setTextAlign('right')
          .run(),
      icon: AlignRight,
      title: 'Align Right',
    },
  ];

  const listButtons = [
    {
      name: 'bulletList',
      isActive: () => editor.isActive('bulletList'),
      command: () => editor.chain().focus().toggleBulletList().run(),
      icon: List,
      title: 'Bullet List',
    },
    {
      name: 'orderedList',
      isActive: () => editor.isActive('orderedList'),
      command: () => editor.chain().focus().toggleOrderedList().run(),
      icon: ListOrdered,
      title: 'Ordered List',
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 p-1 border-b bg-background sticky top-0 z-10 sm:rounded-t-lg">
      {/* History */}
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          // @ts-expect-error undo command is missing from Tiptap types
          onClick={() => editor.chain().focus().undo().run()}
          // @ts-expect-error can().undo() is missing from Tiptap types
          disabled={!editor.can().undo()}
          className="h-8 w-8 p-0"
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          // @ts-expect-error redo command is missing from Tiptap types
          onClick={() => editor.chain().focus().redo().run()}
          // @ts-expect-error can().redo() is missing from Tiptap types
          disabled={!editor.can().redo()}
          className="h-8 w-8 p-0"
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Node Selector (Heading/Paragraph) */}
      <NodeSelector open={openNode} onOpenChange={setOpenNode} />

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Formatting */}
      <div className="flex items-center gap-0.5">
        {formatButtons.map((btn) => (
          <Button
            key={btn.name}
            variant="ghost"
            size="sm"
            onClick={btn.command}
            className={cn('h-8 w-8 p-0', {
              'bg-accent text-accent-foreground': btn.isActive(),
            })}
            title={btn.title}
          >
            <btn.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Alignment */}
      <div className="flex items-center gap-0.5">
        {alignmentButtons.map((btn) => (
          <Button
            key={btn.name}
            variant="ghost"
            size="sm"
            onClick={btn.command}
            className={cn('h-8 w-8 p-0', {
              'bg-accent text-accent-foreground': btn.isActive(),
            })}
            title={btn.title}
          >
            <btn.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Lists & Blocks */}
      <div className="flex items-center gap-0.5">
        {listButtons.map((btn) => (
          <Button
            key={btn.name}
            variant="ghost"
            size="sm"
            onClick={btn.command}
            className={cn('h-8 w-8 p-0', {
              'bg-accent text-accent-foreground': btn.isActive(),
            })}
            title={btn.title}
          >
            <btn.icon className="h-4 w-4" />
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            (editor as any).chain().focus().toggleBlockquote().run()
          }
          className={cn('h-8 w-8 p-0', {
            'bg-accent text-accent-foreground': (editor as any).isActive(
              'blockquote'
            ),
          })}
          title="Blockquote"
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            (editor as any).chain().focus().setHorizontalRule().run()
          }
          className="h-8 w-8 p-0"
          title="Horizontal Rule"
        >
          <Minus className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Color Selector */}
      <ColorSelector open={openColor} onOpenChange={setOpenColor} />

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Insertion Tools */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenLink}
          className={cn('h-8 w-8 p-0', {
            'bg-accent text-accent-foreground': editor.isActive('link'),
          })}
          title="Hyperlink"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="h-8 w-8 p-0"
          title="Upload Image"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          // @ts-expect-error insertTable command is missing from Tiptap types due to type merging issues
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
          className="h-8 w-8 p-0"
          title="Insert Table"
        >
          <Grid className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const url = prompt('Enter YouTube URL');
            if (url) {
              (editor as any).commands.setYoutubeVideo({
                src: url,
              });
            }
          }}
          className="h-8 w-8 p-0"
          title="Insert YouTube Video"
        >
          <YoutubeIcon className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1 border-x px-1 mx-1">
          <Button
            variant="ghost"
            size="sm"
            // @ts-expect-error toggleSuperscript command is missing from Tiptap types due to type merging issues
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('superscript') && 'bg-accent'
            )}
            title="Superscript"
          >
            <SuperscriptIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            // @ts-expect-error toggleSubscript command is missing from Tiptap types due to type merging issues
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('subscript') && 'bg-accent'
            )}
            title="Subscript"
          >
            <SubscriptIcon className="h-4 w-4" />
          </Button>
        </div>
        {onOpenProducts && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenProducts}
            className="h-8 w-8 p-0"
            title="Embed Products"
          >
            <ShoppingBag className="h-4 w-4" />
          </Button>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && editor) {
            const pos = editor.state.selection.from;
            uploadFn(file, editor.view, pos);
          }
        }}
      />
    </div>
  );
};
