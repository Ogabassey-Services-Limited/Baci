import { fireEvent, render, screen } from '@testing-library/react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';
import { describe, expect, it, vi } from 'vitest';

const mockEditor = vi.hoisted(() => {
  const commandChain = {
    focus: vi.fn(),
    insertTable: vi.fn(),
    redo: vi.fn(),
    run: vi.fn(),
    setHorizontalRule: vi.fn(),
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
  };
  for (const command of Object.values(commandChain)) {
    if (typeof command === 'function') command.mockReturnValue(commandChain);
  }
  const canChain = {
    focus: vi.fn(),
    redo: vi.fn(),
    run: vi.fn(),
    undo: vi.fn(),
  };
  canChain.focus.mockReturnValue(canChain);
  canChain.redo.mockReturnValue(canChain);
  canChain.undo.mockReturnValue(canChain);
  canChain.run.mockReturnValue(true);
  return {
    can: () => ({ chain: () => canChain }),
    chain: () => commandChain,
    commands: { setYoutubeVideo: vi.fn() },
    getAttributes: vi.fn(() => ({})),
    isActive: vi.fn(() => false),
    state: { selection: { from: 7 } },
    view: {},
  };
});

vi.mock('novel', () => ({ useEditor: () => ({ editor: mockEditor }) }));
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
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock('@/components/ui/separator', () => ({ Separator: () => null }));
vi.mock('./color-selector', () => ({ ColorSelector: () => null }));
vi.mock('./node-selector', () => ({ NodeSelector: () => null }));

import { EditorToolbar } from './editor-toolbar';

describe('EditorToolbar image uploads', () => {
  it('uses the supplied merchant-scoped uploader for device files', () => {
    const uploadImage = vi.fn();
    const file = new File(['image'], 'inline.png', { type: 'image/png' });
    render(<EditorToolbar onImageUpload={uploadImage} />);

    fireEvent.change(screen.getByLabelText('Upload image'), {
      target: { files: [file] },
    });

    expect(uploadImage).toHaveBeenCalledWith(file, mockEditor.view, 7);
  });
});
