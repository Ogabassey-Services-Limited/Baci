import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CustomerLayout, { metadata } from './layout';

describe('CustomerLayout', () => {
  it('renders customer route content without adding loading chrome', () => {
    render(
      <CustomerLayout>
        <div>Customer content</div>
      </CustomerLayout>
    );

    expect(screen.getByText('Customer content')).toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).toBeNull();
  });

  it('marks customer account routes noindex and nofollow', () => {
    expect(metadata.robots).toMatchObject({
      follow: false,
      index: false,
    });
  });
});
