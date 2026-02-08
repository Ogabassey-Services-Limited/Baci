import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { TagInput } from './tag-input';

describe('TagInput', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders correctly with initial tags', () => {
    render(<TagInput value={['tag1', 'tag2']} onChange={mockOnChange} />);
    expect(screen.getByText('tag1')).toBeInTheDocument();
    expect(screen.getByText('tag2')).toBeInTheDocument();
  });

  it('should have an accessible add button', () => {
    render(<TagInput value={[]} onChange={mockOnChange} />);
    const addButton = screen.getByRole('button', { name: /add tag/i });
    expect(addButton).toBeInTheDocument();
  });

  it('should have accessible remove buttons for tags', () => {
    render(<TagInput value={['tag1']} onChange={mockOnChange} />);
    const removeButton = screen.getByRole('button', { name: /remove tag1/i });
    expect(removeButton).toBeInTheDocument();
  });

  it('should announce when a tag is added', async () => {
    render(<TagInput value={[]} onChange={mockOnChange} />);
    const input = screen.getByPlaceholderText(/type and press enter/i);
    fireEvent.change(input, { target: { value: 'new tag' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('Tag "new tag" added');
    });
  });

  it('should announce when a tag is removed', async () => {
    render(<TagInput value={['tag1']} onChange={mockOnChange} />);

    const removeButton = screen.getByRole('button', { name: /remove tag1/i });
    fireEvent.click(removeButton);

    expect(mockOnChange).toHaveBeenCalledWith([]);

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('Tag "tag1" removed');
    });
  });
});
