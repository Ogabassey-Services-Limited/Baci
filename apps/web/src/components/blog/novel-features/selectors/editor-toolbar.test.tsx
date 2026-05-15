import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type ChainState = {
  canRedo: boolean;
  canUndo: boolean;
};

const {
  mockCanChain,
  mockCommandChain,
  mockEditor,
  mockGetAttributes,
  mockIsActive,
  mockSetImage,
  mockState,
  mockUpdateAttributes,
} = vi.hoisted(() => {
  const commandChain = {
    focus: vi.fn(),
    redo: vi.fn(),
    run: vi.fn(() => true),
    setHorizontalRule: vi.fn(),
    setImage: vi.fn(),
    setTextAlign: vi.fn(),
    toggleBlockquote: vi.fn(),
    toggleBold: vi.fn(),
    toggleBulletList: vi.fn(),
    toggleCode: vi.fn(),
    toggleItalic: vi.fn(),
    toggleOrderedList: vi.fn(),
    toggleStrike: vi.fn(),
    toggleSubscript: vi.fn(),
    toggleSuperscript: vi.fn(),
    toggleUnderline: vi.fn(),
    undo: vi.fn(),
    updateAttributes: vi.fn(),
    insertTable: vi.fn(),
  };
  commandChain.focus.mockReturnValue(commandChain);
  commandChain.undo.mockReturnValue(commandChain);
  commandChain.redo.mockReturnValue(commandChain);
  commandChain.setImage.mockReturnValue(commandChain);
  commandChain.updateAttributes.mockReturnValue(commandChain);
  commandChain.toggleBold.mockReturnValue(commandChain);
  commandChain.toggleItalic.mockReturnValue(commandChain);
  commandChain.toggleUnderline.mockReturnValue(commandChain);
  commandChain.toggleStrike.mockReturnValue(commandChain);
  commandChain.toggleCode.mockReturnValue(commandChain);
  commandChain.setTextAlign.mockReturnValue(commandChain);
  commandChain.toggleBulletList.mockReturnValue(commandChain);
  commandChain.toggleOrderedList.mockReturnValue(commandChain);
  commandChain.toggleBlockquote.mockReturnValue(commandChain);
  commandChain.setHorizontalRule.mockReturnValue(commandChain);
  commandChain.insertTable.mockReturnValue(commandChain);
  commandChain.toggleSuperscript.mockReturnValue(commandChain);
  commandChain.toggleSubscript.mockReturnValue(commandChain);

  const state: ChainState = {
    canRedo: true,
    canUndo: true,
  };
  let canAction: 'undo' | 'redo' | null = null;

  const canChain = {
    focus: vi.fn(),
    redo: vi.fn(),
    run: vi.fn(() => {
      if (canAction === 'undo') {
        return state.canUndo;
      }
      if (canAction === 'redo') {
        return state.canRedo;
      }
      return false;
    }),
    undo: vi.fn(),
  };
  canChain.focus.mockReturnValue(canChain);
  canChain.undo.mockImplementation(() => {
    canAction = 'undo';
    return canChain;
  });
  canChain.redo.mockImplementation(() => {
    canAction = 'redo';
    return canChain;
  });

  const canChainWrapper = {
    chain: vi.fn(() => canChain),
  };

  const getAttributes = vi.fn(() => ({}));
  const isActive = vi.fn((_name: unknown) => false);

  return {
    mockCanChain: canChain,
    mockCanWrapper: canChainWrapper,
    mockCommandChain: commandChain,
    mockEditor: {
      can: vi.fn(() => canChainWrapper),
      chain: vi.fn(() => commandChain),
      commands: {
        setYoutubeVideo: vi.fn(),
      },
      getAttributes,
      isActive,
      state: { selection: { from: 1 } },
      view: {},
    },
    mockGetAttributes: getAttributes,
    mockIsActive: isActive,
    mockSetImage: commandChain.setImage,
    mockState: state,
    mockUpdateAttributes: commandChain.updateAttributes,
  };
});

vi.mock('novel', () => ({
  useEditor: () => ({ editor: mockEditor }),
}));

vi.mock('@/components/blog/novel-features/image-upload', () => ({
  uploadFn: vi.fn(),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    type = 'button',
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({
    children,
    open,
  }: {
    children: ReactNode;
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (open ? <div>{children}</div> : null),
  PopoverContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <span data-testid="separator" />,
}));

vi.mock('@/components/blog/novel-features/selectors/color-selector', () => ({
  ColorSelector: () => <div data-testid="color-selector" />,
}));

vi.mock('@/components/blog/novel-features/selectors/node-selector', () => ({
  NodeSelector: () => <div data-testid="node-selector" />,
}));

vi.mock('@/lib/sanitize-core', () => ({
  sanitizeUrl: vi.fn((value: string) => value),
}));

import { EditorToolbar } from './editor-toolbar';

describe('EditorToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.canUndo = true;
    mockState.canRedo = true;
    mockGetAttributes.mockReturnValue({});
    mockIsActive.mockImplementation(() => false);
  });

  it('runs undo/redo with chain focus command parity', async () => {
    const user = userEvent.setup();
    render(<EditorToolbar />);

    await user.click(screen.getByTitle('Undo'));
    await user.click(screen.getByTitle('Redo'));

    expect(mockCanChain.undo).toHaveBeenCalled();
    expect(mockCanChain.redo).toHaveBeenCalled();
    expect(mockCommandChain.undo).toHaveBeenCalled();
    expect(mockCommandChain.redo).toHaveBeenCalled();
    expect(mockSetImage).not.toHaveBeenCalled();
    expect(mockUpdateAttributes).not.toHaveBeenCalled();
  });

  it('disables undo and redo from can().chain().focus().*.run() checks', () => {
    mockState.canUndo = false;
    mockState.canRedo = false;

    render(<EditorToolbar />);

    expect(screen.getByTitle('Undo')).toBeDisabled();
    expect(screen.getByTitle('Redo')).toBeDisabled();
  });

  it('inserts image from URL with caption stored in image title', async () => {
    const user = userEvent.setup();
    render(<EditorToolbar />);

    await user.click(screen.getByLabelText('Insert image from URL'));
    await user.type(
      screen.getByLabelText('Image URL'),
      'https://cdn.example.com/camera.jpg'
    );
    await user.type(screen.getByLabelText('Caption'), 'Camera sample');
    await user.click(screen.getByText('Insert Image', { selector: 'button' }));

    expect(mockSetImage).toHaveBeenCalledWith({
      src: 'https://cdn.example.com/camera.jpg',
      title: 'Camera sample',
    });
  });

  it('prevents default Enter behavior when inserting an image URL', async () => {
    const user = userEvent.setup();
    render(<EditorToolbar />);

    await user.click(screen.getByLabelText('Insert image from URL'));
    const imageUrlInput = screen.getByLabelText('Image URL');
    await user.type(imageUrlInput, 'https://cdn.example.com/camera.jpg');

    expect(
      fireEvent.keyDown(imageUrlInput, { key: 'Enter', code: 'Enter' })
    ).toBe(false);
    expect(mockSetImage).toHaveBeenCalledWith({
      src: 'https://cdn.example.com/camera.jpg',
      title: null,
    });
  });

  it('updates selected image caption through updateAttributes', async () => {
    const user = userEvent.setup();
    mockIsActive.mockImplementation((name: unknown) => name === 'image');
    mockGetAttributes.mockReturnValue({
      src: 'https://cdn.example.com/camera.jpg',
      title: 'Old caption',
    });

    render(<EditorToolbar />);

    await user.click(screen.getByLabelText('Edit selected image caption'));
    const captionInput = screen.getByLabelText('Caption');
    await user.clear(captionInput);
    await user.type(captionInput, 'Updated caption');
    await user.click(screen.getByRole('button', { name: 'Update Caption' }));

    expect(mockUpdateAttributes).toHaveBeenCalledWith('image', {
      title: 'Updated caption',
    });
  });

  it('prevents default Enter behavior when updating selected image captions', async () => {
    const user = userEvent.setup();
    mockIsActive.mockImplementation((name: unknown) => name === 'image');
    mockGetAttributes.mockReturnValue({
      src: 'https://cdn.example.com/camera.jpg',
      title: 'Old caption',
    });

    render(<EditorToolbar />);

    await user.click(screen.getByLabelText('Edit selected image caption'));
    const captionInput = screen.getByLabelText('Caption');
    await user.clear(captionInput);
    await user.type(captionInput, 'Updated caption');

    expect(
      fireEvent.keyDown(captionInput, { key: 'Enter', code: 'Enter' })
    ).toBe(false);
    expect(mockUpdateAttributes).toHaveBeenCalledWith('image', {
      title: 'Updated caption',
    });
  });

  it('maps empty edited caption to null to avoid blank title attributes', async () => {
    const user = userEvent.setup();
    mockIsActive.mockImplementation((name: unknown) => name === 'image');
    mockGetAttributes.mockReturnValue({
      src: 'https://cdn.example.com/camera.jpg',
      alt: 'Camera sample',
      title: 'Existing caption',
    });

    render(<EditorToolbar />);

    await user.click(screen.getByLabelText('Edit selected image caption'));
    const captionInput = screen.getByLabelText('Caption');
    await user.clear(captionInput);
    await user.click(screen.getByRole('button', { name: 'Update Caption' }));

    expect(mockUpdateAttributes).toHaveBeenCalledWith('image', {
      title: null,
    });
  });
});
