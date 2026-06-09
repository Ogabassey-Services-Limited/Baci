import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SubmitTemplatePage, { metadata } from './page';

vi.mock('./client-page', () => ({
  default: () => <main>Submit template client</main>,
}));

describe('SubmitTemplatePage metadata wrapper', () => {
  it('declares public developer submission metadata', () => {
    expect(metadata).toMatchObject({
      title: 'Submit a Storefront Template - Baci Developers',
      description:
        'Submit a storefront template for review and help African merchants launch better Baci commerce experiences.',
    });
  });

  it('renders the client page boundary', () => {
    render(<SubmitTemplatePage />);

    expect(screen.getByRole('main')).toHaveTextContent(
      'Submit template client'
    );
  });
});
