import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { TagInput } from './tag-input';

// Wrapper component to manage state
const TestWrapper = () => {
  const [tags, setTags] = useState<string[]>(['react', 'vue']);
  return <TagInput value={tags} onChange={setTags} />;
};

describe('TagInput', () => {
  it('should render the input and existing tags', () => {
    render(<TestWrapper />);
    expect(screen.getByDisplayValue('')).toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('vue')).toBeInTheDocument();
  });

  it('should add a tag when clicking the add button', () => {
    render(<TestWrapper />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'angular' } });

    // We expect the button to have a label "Add tag" - this will fail initially
    // Using getByRole('button', { name: ... }) ensures accessible name
    const addButton = screen.getByRole('button', { name: /add tag/i });
    fireEvent.click(addButton);

    expect(screen.getByText('angular')).toBeInTheDocument();
  });

  it('should remove a tag when clicking the remove button', () => {
    render(<TestWrapper />);

    // We expect the remove button to have a label "Remove react" - this will fail initially
    const removeButton = screen.getByRole('button', { name: /remove react/i });
    fireEvent.click(removeButton);

    expect(screen.queryByText('react')).not.toBeInTheDocument();
  });

  it('should use a semantic output element for announcements', () => {
    render(<TestWrapper />);
    // Check for the output element.
    // <output> has an implicit role of status.
    const output = screen.getByRole('status');
    expect(output.tagName).toBe('OUTPUT');
  });
});
