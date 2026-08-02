import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPageHeader } from './dashboard-page-header';

const copy = vi.fn();

describe('DashboardPageHeader', () => {
  beforeEach(() => {
    copy.mockReset();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: copy },
    });
  });

  it('shows a publish action for an offline store', () => {
    const onPublishToggle = vi.fn();

    render(
      <DashboardPageHeader
        businessName="Baci Shop"
        isPublished={false}
        isPublishing={false}
        onPublishToggle={onPublishToggle}
        slug="baci-shop"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Publish Store' }));

    expect(onPublishToggle).toHaveBeenCalledOnce();
    expect(screen.getByText('Store is Offline')).toBeInTheDocument();
  });

  it('copies the absolute store URL from the mobile header', () => {
    render(
      <DashboardPageHeader
        isPublished
        isPublishing={false}
        onPublishToggle={vi.fn()}
        slug="baci-shop"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Share link' }));

    expect(copy).toHaveBeenCalledWith(`${window.location.origin}/baci-shop`);
    expect(screen.getByRole('link', { name: 'Visit store' })).toHaveAttribute(
      'href',
      '/baci-shop'
    );
  });
});
