import { render, screen } from '@testing-library/react';
import { TagInput } from './tag-input';

describe('TagInput', () => {
  it('should have an accessible label for the Add button', () => {
    render(
      <TagInput
        value={[]}
        onChange={() => {
          /* no-op */
        }}
      />
    );
    // The button is disabled initially because input is empty, but it should still be findable by label
    const addButton = screen.getByRole('button', { name: /add tag/i });
    expect(addButton).toBeInTheDocument();
  });

  it('should have accessible labels for remove buttons', () => {
    const tags = ['react', 'nextjs'];
    render(
      <TagInput
        value={tags}
        onChange={() => {
          /* no-op */
        }}
      />
    );

    const removeReact = screen.getByRole('button', { name: /remove react/i });
    const removeNext = screen.getByRole('button', { name: /remove nextjs/i });

    expect(removeReact).toBeInTheDocument();
    expect(removeNext).toBeInTheDocument();
  });

  it('should use semantic output element for live announcements', () => {
    render(
      <TagInput
        value={[]}
        onChange={() => {
          /* no-op */
        }}
      />
    );
    // querying by role "status" finds implicit role of <output> or explicit role="status"
    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion.tagName).toBe('OUTPUT');
  });
});
