import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const {
  mockCreateImageUploader,
  mockCreateSuggestionItems,
  mockHandleImageDrop,
  mockHandleImagePaste,
  mockToolbarUpload,
} = vi.hoisted(() => ({
  mockCreateImageUploader: vi.fn(),
  mockCreateSuggestionItems: vi.fn(),
  mockHandleImageDrop: vi.fn(),
  mockHandleImagePaste: vi.fn(),
  mockToolbarUpload: vi.fn(),
}));

vi.mock('novel', () => ({
  EditorRoot: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  EditorContent: ({
    children,
    editorProps,
    slotAfter,
    slotBefore,
  }: {
    children: React.ReactNode;
    editorProps: {
      handleDrop: (...args: unknown[]) => unknown;
      handlePaste: (...args: unknown[]) => unknown;
    };
    slotAfter: React.ReactNode;
    slotBefore: React.ReactNode;
  }) => {
    editorProps.handlePaste('view', 'paste-event');
    editorProps.handleDrop('view', 'drop-event', 'slice', false);
    return (
      <>
        {slotBefore}
        {slotAfter}
        {children}
      </>
    );
  },
  EditorBubble: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  EditorCommand: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  EditorCommandEmpty: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  EditorCommandItem: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  EditorCommandList: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  handleCommandNavigation: vi.fn(),
  handleImageDrop: mockHandleImageDrop,
  handleImagePaste: mockHandleImagePaste,
}));

vi.mock('@/components/blog/novel-features/image-upload', () => ({
  createImageUploader: mockCreateImageUploader,
  createMerchantImageUploader: vi.fn(),
}));

vi.mock('./novel-features/extensions', () => ({ defaultExtensions: [] }));
vi.mock('./novel-features/product-extension', () => ({
  ProductExtension: { configure: vi.fn(() => ({ name: 'product' })) },
}));
vi.mock('@/components/blog/novel-features/slash-command', () => ({
  createSuggestionItems: mockCreateSuggestionItems.mockReturnValue([]),
}));
vi.mock('@/components/blog/novel-features/slash-command-extension', () => ({
  createSlashCommand: vi.fn(() => ({ name: 'slash' })),
}));
vi.mock('./novel-features/selectors/editor-toolbar', () => ({
  EditorToolbar: ({ onImageUpload }: { onImageUpload: unknown }) => {
    mockToolbarUpload(onImageUpload);
    return null;
  },
}));
vi.mock('./novel-features/selectors/color-selector', () => ({
  ColorSelector: () => null,
}));
vi.mock('./novel-features/selectors/link-selector', () => ({
  LinkSelector: () => null,
}));
vi.mock('./novel-features/selectors/node-selector', () => ({
  NodeSelector: () => null,
}));
vi.mock('./novel-features/selectors/text-buttons', () => ({
  TextButtons: () => null,
}));
vi.mock('./product-embed', () => ({ ProductEmbedPicker: () => null }));
vi.mock('@/components/ui/separator', () => ({ Separator: () => null }));

import NovelEditor from './novel-editor';

describe('NovelEditor merchant image upload', () => {
  it('wraps raw URLs once and uses the wrapped uploader for every editor image entry point', () => {
    const rawImageUpload = vi.fn();
    const wrappedImageUpload = vi.fn();
    mockCreateImageUploader.mockReturnValue(wrappedImageUpload);

    render(<NovelEditor onChange={vi.fn()} onImageUpload={rawImageUpload} />);

    expect(mockCreateImageUploader).toHaveBeenCalledWith(rawImageUpload);
    expect(mockCreateSuggestionItems).toHaveBeenCalledWith(wrappedImageUpload);
    expect(mockHandleImagePaste).toHaveBeenCalledWith(
      'view',
      'paste-event',
      wrappedImageUpload
    );
    expect(mockHandleImageDrop).toHaveBeenCalledWith(
      'view',
      'drop-event',
      false,
      wrappedImageUpload
    );
    expect(mockToolbarUpload).toHaveBeenCalledWith(wrappedImageUpload);
  });
});
