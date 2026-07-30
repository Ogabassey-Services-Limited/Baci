import type { WebStoreReadiness } from '@baci/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SetupChecklistContent } from './setup-checklist-content';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const readiness = {
  merchantId: '11111111-1111-4111-8111-111111111111',
  surface: 'web',
  isReady: false,
  isPublished: false,
  completedRequired: 0,
  totalRequired: 1,
  completedRecommended: 0,
  totalRecommended: 0,
  overallProgress: 0,
  storeBuild: {
    starterStoreReady: false,
    aiStatus: 'not_started',
    latestJobId: null,
    canApplyAiDraft: false,
    message: 'Store setup is incomplete.',
  },
  items: [
    {
      id: 'payment_method',
      label: 'Add payment method',
      description: 'Connect a payment provider.',
      completed: false,
      priority: 'required',
      category: 'payments',
    },
  ],
} satisfies WebStoreReadiness;

describe('SetupChecklistContent', () => {
  it('renders canonical item navigation and expands additional items', () => {
    const setShowAll = vi.fn();
    const incompleteItems = [
      ...readiness.items,
      { ...readiness.items[0], id: 'first_product' as const },
      { ...readiness.items[0], id: 'country' as const },
      { ...readiness.items[0], id: 'contact_info' as const },
    ];

    render(
      <SetupChecklistContent
        compact={false}
        displayItems={readiness.items}
        incompleteItems={incompleteItems}
        readiness={readiness}
        requiredIncomplete={readiness.items}
        setShowAll={setShowAll}
        showAll={false}
      />
    );

    expect(
      screen.getByRole('link', { name: /add payment method/i })
    ).toHaveAttribute('href', '/dashboard/settings/payments?onboarding=true');
    expect(screen.getByText('Next Step')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /show 1 more/i }));
    expect(setShowAll).toHaveBeenCalledWith(true);
  });
});
