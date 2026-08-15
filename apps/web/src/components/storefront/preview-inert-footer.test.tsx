import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PreviewInertFooter } from './preview-inert-footer';

describe('PreviewInertFooter', () => {
  it('matches the published layout while keeping footer actions inert', () => {
    render(
      <PreviewInertFooter
        quickLinks={[{ label: 'Contact' }]}
        showNewsletter
        socialLinks={{ instagram: 'https://instagram.com/store' }}
      />
    );

    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveClass('mt-auto', 'py-12');
    expect(footer.firstElementChild).toHaveClass(
      'container',
      'mx-auto',
      'px-4'
    );
    expect(footer.firstElementChild?.firstElementChild).toHaveClass(
      'grid',
      'gap-8',
      'sm:grid-cols-2',
      'lg:grid-cols-4'
    );
    expect(screen.getByRole('button', { name: 'Contact' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'instagram' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeDisabled();
  });
});
