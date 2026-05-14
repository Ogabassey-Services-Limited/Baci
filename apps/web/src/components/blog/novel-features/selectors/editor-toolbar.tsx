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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { sanitizeUrl } from '@/lib/sanitize-core';
import { cn } from '@/lib/utils';
import { ColorSelector } from './color-selector';
import { NodeSelector } from './node-selector';

interface EditorToolbarProps {
  onOpenLink?: () => void;
  onOpenProducts?: () => void;
}

type ImagePopoverMode = 'insert' | 'edit-caption';

export const EditorToolbar = ({
  onOpenLink,
  onOpenProducts,
}: EditorToolbarProps) => {
  const { editor: _editor } = useEditor();
  // biome-ignore lint/suspicious/noExplicitAny: Tiptap types can be complex in novel
  const editor = _editor as any;
  const [openNode, setOpenNode] = useState(false);
  const [openColor, setOpenColor] = useState(false);
  const [imageUrlOpen, setImageUrlOpen] = useState(false);
  const [imagePopoverMode, setImagePopoverMode] =
    useState<ImagePopoverMode>('insert');
  const [imageUrlValue, setImageUrlValue] = useState('');
  const [imageCaptionValue, setImageCaptionValue] = useState('');
  const [imageUrlError, setImageUrlError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const normalizeImageCaption = (value: string): string | null => {
    const caption = value.trim();
    return caption ? caption : null;
  };

  const openImageInsertPopover = () => {
    setImagePopoverMode('insert');
    setImageUrlValue('');
    setImageCaptionValue('');
    setImageUrlError(null);
    setImageUrlOpen(true);
  };

  const openImageCaptionPopover = () => {
    const imageAttrs = (editor.getAttributes('image') ?? {}) as {
      title?: string | null;
    };
    setImagePopoverMode('edit-caption');
    setImageCaptionValue(
      typeof imageAttrs.title === 'string' ? imageAttrs.title : ''
    );
    setImageUrlError(null);
    setImageUrlOpen(true);
  };

  const closeImagePopover = () => {
    setImageUrlOpen(false);
    setImageUrlError(null);
  };

  const _insertImageFromUrl = () => {
    const url = imageUrlValue.trim();
    if (!url) return;

    const sanitized = sanitizeUrl(url);
    if (!sanitized) {
      setImageUrlError('Invalid image URL');
      return;
    }

    try {
      const parsed = new URL(sanitized);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        setImageUrlError('Invalid image URL');
        return;
      }
    } catch {
      setImageUrlError('Invalid image URL');
      return;
    }

    editor
      .chain()
      .focus()
      .setImage({
        src: sanitized,
        title: normalizeImageCaption(imageCaptionValue),
      })
      .run();
    setImageUrlValue('');
    setImageCaptionValue('');
    setImageUrlError(null);
    closeImagePopover();
  };

  const _updateSelectedImageCaption = () => {
    if (!editor.isActive('image')) {
      return;
    }

    editor
      .chain()
      .focus()
      .updateAttributes('image', {
        title: normalizeImageCaption(imageCaptionValue),
      })
      .run();
    setImageCaptionValue('');
    closeImagePopover();
  };

  const handleUndo = () => editor.chain().focus().undo().run();
  const handleRedo = () => editor.chain().focus().redo().run();
  const canUndo = editor.can().chain().focus().undo().run();
  const canRedo = editor.can().chain().focus().redo().run();

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
      command: () => editor.chain().focus().setTextAlign('left').run(),
      icon: AlignLeft,
      title: 'Align Left',
    },
    {
      name: 'center',
      isActive: () => editor.isActive({ textAlign: 'center' }),
      command: () => editor.chain().focus().setTextAlign('center').run(),
      icon: AlignCenter,
      title: 'Align Center',
    },
    {
      name: 'right',
      isActive: () => editor.isActive({ textAlign: 'right' }),
      command: () => editor.chain().focus().setTextAlign('right').run(),
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
          type="button"
          onClick={handleUndo}
          disabled={!canUndo}
          className="h-8 w-8 p-0"
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={handleRedo}
          disabled={!canRedo}
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
            type="button"
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
            type="button"
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
            type="button"
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
          type="button"
          onClick={() =>
            // biome-ignore lint/suspicious/noExplicitAny: Tiptap types can be complex
            (editor as any).chain().focus().toggleBlockquote().run()
          }
          className={cn('h-8 w-8 p-0', {
            'bg-accent text-accent-foreground':
              // biome-ignore lint/suspicious/noExplicitAny: Tiptap types can be complex
              (editor as any).isActive('blockquote'),
          })}
          title="Blockquote"
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() =>
            // biome-ignore lint/suspicious/noExplicitAny: Tiptap types can be complex
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
          type="button"
          onClick={onOpenLink}
          className={cn('h-8 w-8 p-0', {
            'bg-accent text-accent-foreground': editor.isActive('link'),
          })}
          title="Hyperlink"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="h-8 w-8 p-0"
              title="Insert Image"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload image from device"
            >
              <ImageIcon className="mr-2 h-4 w-4" />
              Upload from device
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={openImageInsertPopover}
              aria-label="Insert image from URL"
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              Insert from URL
            </DropdownMenuItem>
            {editor.isActive('image') ? (
              <DropdownMenuItem
                onClick={openImageCaptionPopover}
                aria-label="Edit selected image caption"
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Edit caption
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        <Popover
          open={imageUrlOpen}
          onOpenChange={(open) => {
            setImageUrlOpen(open);
            if (!open) {
              setImageUrlError(null);
            }
          }}
        >
          <PopoverContent
            align="start"
            className="w-80 p-3"
            onInteractOutside={closeImagePopover}
          >
            <div className="space-y-2">
              {imagePopoverMode === 'insert' ? (
                <>
                  <label
                    htmlFor="image-url-input"
                    className="text-sm font-medium"
                  >
                    Image URL
                  </label>
                  <Input
                    id="image-url-input"
                    placeholder="https://example.com/image.jpg"
                    value={imageUrlValue}
                    onChange={(e) => {
                      setImageUrlValue(e.target.value);
                      if (imageUrlError) setImageUrlError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        _insertImageFromUrl();
                      }
                    }}
                  />
                </>
              ) : null}
              <label
                htmlFor="image-caption-input"
                className="text-sm font-medium"
              >
                Caption
              </label>
              <Input
                id="image-caption-input"
                placeholder="Optional image caption"
                value={imageCaptionValue}
                onChange={(e) => setImageCaptionValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') {
                    return;
                  }
                  if (imagePopoverMode === 'insert') {
                    _insertImageFromUrl();
                    return;
                  }
                  _updateSelectedImageCaption();
                }}
              />
              {imageUrlError ? (
                <p className="text-xs text-destructive">{imageUrlError}</p>
              ) : null}
              <Button
                size="sm"
                type="button"
                className="w-full"
                disabled={
                  imagePopoverMode === 'insert' ? !imageUrlValue.trim() : false
                }
                onClick={() => {
                  if (imagePopoverMode === 'insert') {
                    _insertImageFromUrl();
                    return;
                  }
                  _updateSelectedImageCaption();
                }}
              >
                {imagePopoverMode === 'insert'
                  ? 'Insert Image'
                  : 'Update Caption'}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="sm"
          type="button"
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
          type="button"
          onClick={() => {
            const url = prompt('Enter YouTube URL');
            if (url) {
              const sanitized = sanitizeUrl(url.trim());
              if (sanitized) {
                // biome-ignore lint/suspicious/noExplicitAny: Tiptap types can be complex
                (editor as any).commands.setYoutubeVideo({
                  src: sanitized,
                });
              } else {
                alert(
                  'Invalid YouTube URL. Please enter a valid https:// URL.'
                );
              }
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
            type="button"
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
            type="button"
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
            type="button"
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
          e.target.value = '';
        }}
      />
    </div>
  );
};
