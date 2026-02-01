import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { TagInput } from './tag-input';

// Wrapper component to handle state
function TagInputWrapper({
  initialTags = [],
  maxTags,
}: {
  initialTags?: string[];
  maxTags?: number;
}) {
  const [tags, setTags] = useState(initialTags);
  return (
    <TagInput
      value={tags}
      onChange={setTags}
      placeholder="Add a tag"
      maxTags={maxTags}
    />
  );
}

describe('TagInput', () => {
  it('renders initial tags', () => {
    render(<TagInputWrapper initialTags={['React', 'Next.js']} />);
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Next.js')).toBeInTheDocument();
  });

  it('adds a tag via button', () => {
    render(<TagInputWrapper />);
    const input = screen.getByPlaceholderText('Add a tag');
    const addButton = screen.getByRole('button', { name: /add tag/i });

    fireEvent.change(input, { target: { value: 'TypeScript' } });
    fireEvent.click(addButton);

    expect(screen.getByText('TypeScript')).toBeInTheDocument();
  });

  it('adds a tag via Enter key', () => {
    render(<TagInputWrapper />);
    const input = screen.getByPlaceholderText('Add a tag');

    fireEvent.change(input, { target: { value: 'Vitest' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(screen.getByText('Vitest')).toBeInTheDocument();
  });

  it('removes a tag', () => {
    render(<TagInputWrapper initialTags={['Vue']} />);
    expect(screen.getByText('Vue')).toBeInTheDocument();

    const removeButton = screen.getByRole('button', { name: /remove vue/i });
    fireEvent.click(removeButton);

    expect(screen.queryByText('Vue')).not.toBeInTheDocument();
  });

  it('respects maxTags limit', () => {
    render(<TagInputWrapper maxTags={2} initialTags={['One', 'Two']} />);
    const input = screen.getByPlaceholderText('');

    // Attempt to add third tag
    fireEvent.change(input, { target: { value: 'Three' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(screen.queryByText('Three')).not.toBeInTheDocument();
  });

  it('announces actions via live region', () => {
    render(<TagInputWrapper />);
    const input = screen.getByPlaceholderText('Add a tag');
    // Using querySelector because implicit role 'status' for output is not always robust in JSDOM versions or text content access
    // But we added role="status" implicitly via <output> or explicitly?
    // In our code: <output className="sr-only" aria-live="polite">
    // Implicit role for output is status.

    // Add tag
    fireEvent.change(input, { target: { value: 'Accessibility' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // We can just check the output element text
    const liveRegion = screen.getByRole('status', { hidden: true }); // hidden: true because it has sr-only class
    expect(liveRegion).toHaveTextContent('Tag "Accessibility" added');

    // Remove tag
    const removeButton = screen.getByRole('button', {
      name: /remove accessibility/i,
    });
    fireEvent.click(removeButton);
    expect(liveRegion).toHaveTextContent('Tag "Accessibility" removed');
  });
});
