import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TagInput } from './tag-input';

describe('TagInput', () => {
  const mockOnChange = vi.fn();

  it('renders with initial tags', () => {
    render(<TagInput value={['react', 'nextjs']} onChange={mockOnChange} />);
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('nextjs')).toBeInTheDocument();
  });

  it('has accessible add button', () => {
    render(<TagInput value={[]} onChange={mockOnChange} />);
    // This expects an accessible name "Add tag"
    const addButton = screen.getByRole('button', { name: /add tag/i });
    expect(addButton).toBeInTheDocument();
  });

  it('has accessible remove buttons for tags', () => {
    render(<TagInput value={['accessibility']} onChange={mockOnChange} />);
    // This expects an accessible name "Remove accessibility"
    const removeButton = screen.getByRole('button', {
      name: /remove accessibility/i,
    });
    expect(removeButton).toBeInTheDocument();
  });
});
