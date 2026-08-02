import { fireEvent, render, screen } from '@testing-library/react';
import type { ButtonHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

const { mockRedo, mockTiptap, mockUndo } = vi.hoisted(() => {
  const mockUndo = vi.fn();
  const mockRedo = vi.fn();
  const chain = {
    focus: vi.fn(),
    redo: mockRedo,
    run: vi.fn(),
    undo: mockUndo,
  };
  chain.focus.mockReturnValue(chain);
  chain.undo.mockReturnValue(chain);
  chain.redo.mockReturnValue(chain);
  const mockTiptap = {
    can: () => ({ chain: () => chain }),
    chain: () => chain,
    isActive: vi.fn(() => false),
  };
  return { mockRedo, mockTiptap, mockUndo };
});

vi.mock('../utils/tiptap', () => ({ getTiptap: () => mockTiptap }));
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
vi.mock('@/components/ui/separator', () => ({ Separator: () => null }));
vi.mock('./color-selector', () => ({ ColorSelector: () => null }));
vi.mock('./node-selector', () => ({ NodeSelector: () => null }));

import { EditorFormatControls } from './editor-format-controls';

describe('EditorFormatControls', () => {
  it('keeps history controls connected to the editor command chain', () => {
    render(<EditorFormatControls editor={{}} />);

    fireEvent.click(screen.getByTitle('Undo'));
    fireEvent.click(screen.getByTitle('Redo'));

    expect(mockUndo).toHaveBeenCalled();
    expect(mockRedo).toHaveBeenCalled();
  });
});
