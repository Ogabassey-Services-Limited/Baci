'use client';

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  Strikethrough,
  Underline,
  Undo,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { getTiptap } from '../utils/tiptap';
import { ColorSelector } from './color-selector';
import { NodeSelector } from './node-selector';

export function EditorFormatControls({ editor }: { editor: unknown }) {
  const [openNode, setOpenNode] = useState(false);
  const [openColor, setOpenColor] = useState(false);
  const tiptap = getTiptap(editor);
  const formatButtons = [
    {
      name: 'bold',
      isActive: () => tiptap?.isActive('bold'),
      command: () => tiptap?.chain().focus().toggleBold().run(),
      icon: Bold,
      title: 'Bold (Cmd+B)',
    },
    {
      name: 'italic',
      isActive: () => tiptap?.isActive('italic'),
      command: () => tiptap?.chain().focus().toggleItalic().run(),
      icon: Italic,
      title: 'Italic (Cmd+I)',
    },
    {
      name: 'underline',
      isActive: () => tiptap?.isActive('underline'),
      command: () => tiptap?.chain().focus().toggleUnderline().run(),
      icon: Underline,
      title: 'Underline (Cmd+U)',
    },
    {
      name: 'strike',
      isActive: () => tiptap?.isActive('strike'),
      command: () => tiptap?.chain().focus().toggleStrike().run(),
      icon: Strikethrough,
      title: 'Strikethrough',
    },
    {
      name: 'code',
      isActive: () => tiptap?.isActive('code'),
      command: () => tiptap?.chain().focus().toggleCode().run(),
      icon: Code,
      title: 'Code Inline',
    },
  ];
  const alignmentButtons = [
    {
      name: 'left',
      isActive: () => tiptap?.isActive({ textAlign: 'left' }),
      command: () => tiptap?.chain().focus().setTextAlign('left').run(),
      icon: AlignLeft,
      title: 'Align Left',
    },
    {
      name: 'center',
      isActive: () => tiptap?.isActive({ textAlign: 'center' }),
      command: () => tiptap?.chain().focus().setTextAlign('center').run(),
      icon: AlignCenter,
      title: 'Align Center',
    },
    {
      name: 'right',
      isActive: () => tiptap?.isActive({ textAlign: 'right' }),
      command: () => tiptap?.chain().focus().setTextAlign('right').run(),
      icon: AlignRight,
      title: 'Align Right',
    },
  ];
  const listButtons = [
    {
      name: 'bulletList',
      isActive: () => tiptap?.isActive('bulletList'),
      command: () => tiptap?.chain().focus().toggleBulletList().run(),
      icon: List,
      title: 'Bullet List',
    },
    {
      name: 'orderedList',
      isActive: () => tiptap?.isActive('orderedList'),
      command: () => tiptap?.chain().focus().toggleOrderedList().run(),
      icon: ListOrdered,
      title: 'Ordered List',
    },
  ];

  return (
    <>
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => tiptap?.chain().focus().undo().run()}
          disabled={!tiptap?.can().chain().focus().undo().run()}
          className="size-8 p-0"
          title="Undo"
        >
          <Undo className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => tiptap?.chain().focus().redo().run()}
          disabled={!tiptap?.can().chain().focus().redo().run()}
          className="size-8 p-0"
          title="Redo"
        >
          <Redo className="size-4" />
        </Button>
      </div>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <NodeSelector open={openNode} onOpenChange={setOpenNode} />
      <Separator orientation="vertical" className="mx-1 h-6" />
      <div className="flex items-center gap-0.5">
        {formatButtons.map((button) => (
          <Button
            key={button.name}
            variant="ghost"
            size="sm"
            type="button"
            onClick={button.command}
            className={cn('size-8 p-0', {
              'bg-accent text-accent-foreground': button.isActive(),
            })}
            title={button.title}
          >
            <button.icon className="size-4" />
          </Button>
        ))}
      </div>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <div className="flex items-center gap-0.5">
        {alignmentButtons.map((button) => (
          <Button
            key={button.name}
            variant="ghost"
            size="sm"
            type="button"
            onClick={button.command}
            className={cn('size-8 p-0', {
              'bg-accent text-accent-foreground': button.isActive(),
            })}
            title={button.title}
          >
            <button.icon className="size-4" />
          </Button>
        ))}
      </div>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <div className="flex items-center gap-0.5">
        {listButtons.map((button) => (
          <Button
            key={button.name}
            variant="ghost"
            size="sm"
            type="button"
            onClick={button.command}
            className={cn('size-8 p-0', {
              'bg-accent text-accent-foreground': button.isActive(),
            })}
            title={button.title}
          >
            <button.icon className="size-4" />
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => tiptap?.chain().focus().toggleBlockquote().run()}
          className={cn('size-8 p-0', {
            'bg-accent text-accent-foreground': tiptap?.isActive('blockquote'),
          })}
          title="Blockquote"
        >
          <Quote className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => tiptap?.chain().focus().setHorizontalRule().run()}
          className="size-8 p-0"
          title="Horizontal Rule"
        >
          <Minus className="size-4" />
        </Button>
      </div>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ColorSelector open={openColor} onOpenChange={setOpenColor} />
      <Separator orientation="vertical" className="mx-1 h-6" />
    </>
  );
}
