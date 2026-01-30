import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { TagInput } from './tag-input';

function TagInputWrapper({ initialTags = [] }: { initialTags?: string[] }) {
  const [tags, setTags] = useState(initialTags);
  return <TagInput value={tags} onChange={setTags} placeholder="Add a tag" />;
}

describe('TagInput', () => {
  it('renders initial tags', () => {
    render(<TagInputWrapper initialTags={['react', 'javascript']} />);
    expect(screen.getByText('react')).toBeDefined();
    expect(screen.getByText('javascript')).toBeDefined();
  });

  it('adds a tag on enter', () => {
    render(<TagInputWrapper initialTags={[]} />);
    const input = screen.getByPlaceholderText('Add a tag');

    fireEvent.change(input, { target: { value: 'typescript' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(screen.getByText('typescript')).toBeDefined();
  });

  it('has accessible remove buttons', () => {
    render(<TagInputWrapper initialTags={['react']} />);
    // This expects to find a button with aria-label "Remove react"
    expect(screen.getByRole('button', { name: 'Remove react' })).toBeDefined();
  });
});
