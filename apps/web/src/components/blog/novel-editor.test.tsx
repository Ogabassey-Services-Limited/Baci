import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import NovelEditor from './novel-editor';

// Mock Novel editor components to avoid deep Tiptap rendering
vi.mock('novel', () => ({
  EditorRoot: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="editor-root">{children}</div>
  ),
  EditorContent: ({
    children,
    slotBefore,
    slotAfter,
  }: {
    children: React.ReactNode;
    slotBefore?: React.ReactNode;
    slotAfter?: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <div data-testid="editor-content">
      {slotBefore}
      <div data-testid="editor-area" />
      {slotAfter}
      {children}
    </div>
  ),
  EditorBubble: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="editor-bubble">{children}</div>
  ),
  EditorCommand: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="editor-command">{children}</div>
  ),
  EditorCommandEmpty: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  EditorCommandItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <div data-testid={`command-item-${value}`}>{children}</div>,
  EditorCommandList: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  handleCommandNavigation: vi.fn(),
  handleImageDrop: vi.fn(),
  handleImagePaste: vi.fn(),
}));

vi.mock('@/components/blog/novel-features/image-upload', () => ({
  uploadFn: vi.fn(),
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <div data-testid="separator" />,
}));

vi.mock('./novel-features/extensions', () => ({
  defaultExtensions: [],
}));

vi.mock('./novel-features/product-extension', () => ({
  ProductExtension: {
    configure: vi.fn(() => ({ name: 'productExtension' })),
  },
}));

vi.mock('./novel-features/selectors/color-selector', () => ({
  ColorSelector: () => <div data-testid="color-selector" />,
}));

vi.mock('./novel-features/selectors/editor-toolbar', () => ({
  EditorToolbar: ({
    onOpenProducts,
  }: {
    onOpenLink: () => void;
    onOpenProducts?: () => void;
  }) => (
    <div data-testid="editor-toolbar">
      {onOpenProducts && (
        <button
          type="button"
          data-testid="products-toolbar-btn"
          onClick={onOpenProducts}
        >
          Products
        </button>
      )}
    </div>
  ),
}));

vi.mock('./novel-features/selectors/link-selector', () => ({
  LinkSelector: () => <div data-testid="link-selector" />,
}));

vi.mock('./novel-features/selectors/node-selector', () => ({
  NodeSelector: () => <div data-testid="node-selector" />,
}));

vi.mock('./novel-features/selectors/text-buttons', () => ({
  TextButtons: () => <div data-testid="text-buttons" />,
}));

vi.mock('./novel-features/slash-command', () => ({
  slashCommand: { name: 'slashCommand' },
  suggestionItems: [
    {
      title: 'Heading 1',
      description: 'Big heading',
      icon: 'H1',
      command: vi.fn(),
    },
    {
      title: 'Bullet List',
      description: 'Create a list',
      icon: 'UL',
      command: vi.fn(),
    },
  ],
}));

vi.mock('./product-embed', () => ({
  ProductEmbedPicker: ({
    open,
    onClose,
    onSelect,
  }: {
    open: boolean;
    onClose: () => void;
    onSelect: (products: { id: string; [key: string]: unknown }[]) => void;
    selectedIds: string[];
  }) =>
    open ? (
      <div data-testid="product-picker">
        <button type="button" data-testid="picker-close" onClick={onClose}>
          Close
        </button>
        <button
          type="button"
          data-testid="picker-select"
          onClick={() =>
            onSelect([
              {
                id: 'prod-1',
                name: 'Test',
                price: 100,
                images: [],
                slug: 'test',
                status: 'active',
              },
            ])
          }
        >
          Select
        </button>
      </div>
    ) : null,
}));

describe('NovelEditor', () => {
  const defaultProps = {
    onChange: vi.fn(),
  };

  it('renders the editor root and content', () => {
    render(<NovelEditor {...defaultProps} />);

    expect(screen.getByTestId('editor-root')).toBeInTheDocument();
    expect(screen.getByTestId('editor-content')).toBeInTheDocument();
  });

  it('renders the toolbar', () => {
    render(<NovelEditor {...defaultProps} />);

    expect(screen.getByTestId('editor-toolbar')).toBeInTheDocument();
  });

  it('renders the bubble menu with selectors', () => {
    render(<NovelEditor {...defaultProps} />);

    expect(screen.getByTestId('editor-bubble')).toBeInTheDocument();
    expect(screen.getByTestId('node-selector')).toBeInTheDocument();
    expect(screen.getByTestId('link-selector')).toBeInTheDocument();
    expect(screen.getByTestId('text-buttons')).toBeInTheDocument();
    expect(screen.getByTestId('color-selector')).toBeInTheDocument();
  });

  it('renders slash command suggestion items', () => {
    render(<NovelEditor {...defaultProps} />);

    expect(screen.getByText('Heading 1')).toBeInTheDocument();
    expect(screen.getByText('Bullet List')).toBeInTheDocument();
    expect(screen.getByText('Big heading')).toBeInTheDocument();
    expect(screen.getByText('Create a list')).toBeInTheDocument();
  });

  it('does not show product picker when onProductsChange is not provided', () => {
    render(<NovelEditor {...defaultProps} />);

    expect(screen.queryByTestId('product-picker')).not.toBeInTheDocument();
  });

  it('does not show products toolbar button when onProductsChange is not provided', () => {
    render(<NovelEditor {...defaultProps} />);

    expect(
      screen.queryByTestId('products-toolbar-btn')
    ).not.toBeInTheDocument();
  });

  it('shows products toolbar button when onProductsChange is provided', () => {
    render(<NovelEditor {...defaultProps} onProductsChange={vi.fn()} />);

    expect(screen.getByTestId('products-toolbar-btn')).toBeInTheDocument();
  });

  it('opens product picker when toolbar products button is clicked', async () => {
    const user = userEvent.setup();
    render(<NovelEditor {...defaultProps} onProductsChange={vi.fn()} />);

    expect(screen.queryByTestId('product-picker')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('products-toolbar-btn'));

    expect(screen.getByTestId('product-picker')).toBeInTheDocument();
  });

  it('closes product picker when close is clicked', async () => {
    const user = userEvent.setup();
    render(<NovelEditor {...defaultProps} onProductsChange={vi.fn()} />);

    await user.click(screen.getByTestId('products-toolbar-btn'));
    expect(screen.getByTestId('product-picker')).toBeInTheDocument();

    await user.click(screen.getByTestId('picker-close'));
    expect(screen.queryByTestId('product-picker')).not.toBeInTheDocument();
  });

  it('calls onProductsChange with selected products and closes picker', async () => {
    const user = userEvent.setup();
    const onProductsChange = vi.fn();
    render(
      <NovelEditor
        {...defaultProps}
        onProductsChange={onProductsChange}
        embeddedProducts={[]}
      />
    );

    await user.click(screen.getByTestId('products-toolbar-btn'));
    await user.click(screen.getByTestId('picker-select'));

    expect(onProductsChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'prod-1', name: 'Test' }),
    ]);
    expect(screen.queryByTestId('product-picker')).not.toBeInTheDocument();
  });

  it('does not add duplicate products when selecting already embedded ones', async () => {
    const user = userEvent.setup();
    const onProductsChange = vi.fn();
    const existingProduct = {
      id: 'prod-1',
      name: 'Test',
      price: 100,
      images: [],
      slug: 'test',
      status: 'active',
    };

    render(
      <NovelEditor
        {...defaultProps}
        onProductsChange={onProductsChange}
        embeddedProducts={[existingProduct]}
      />
    );

    await user.click(screen.getByTestId('products-toolbar-btn'));
    await user.click(screen.getByTestId('picker-select'));

    // Should not duplicate - existing product already in list
    expect(onProductsChange).toHaveBeenCalledWith([existingProduct]);
  });
});
