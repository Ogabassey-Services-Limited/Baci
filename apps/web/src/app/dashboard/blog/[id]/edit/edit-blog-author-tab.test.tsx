import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditBlogAuthorTab } from './edit-blog-author-tab';
import { INITIAL_FORM_DATA } from './edit-blog-form-data';

describe('EditBlogAuthorTab', () => {
  it('reports author bio edits through the form field contract', async () => {
    const handleChange = vi.fn();
    render(
      <EditBlogAuthorTab
        formData={{ ...INITIAL_FORM_DATA, author_bio: 'Trusted reviewer' }}
        handleChange={handleChange}
      />
    );

    const bio = screen.getByLabelText('Author Bio');
    fireEvent.change(bio, { target: { value: 'Hands-on product testing' } });

    expect(handleChange).toHaveBeenLastCalledWith(
      'author_bio',
      'Hands-on product testing'
    );
    expect(screen.getByText('16/500 characters')).toBeInTheDocument();
  });
});
