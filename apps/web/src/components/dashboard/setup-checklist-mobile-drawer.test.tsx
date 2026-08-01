import type { WebStoreReadiness } from '@baci/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SetupChecklistMobileDrawer } from './setup-checklist-mobile-drawer';

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SheetDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  SheetTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
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
  items: [],
} satisfies WebStoreReadiness;

describe('SetupChecklistMobileDrawer', () => {
  it('opens from the accessible finish-setup trigger', () => {
    const onOpenChange = vi.fn();

    render(
      <SetupChecklistMobileDrawer
        compact={false}
        displayItems={[]}
        incompleteItems={[]}
        isOpen={false}
        onOpenChange={onOpenChange}
        onPublish={vi.fn()}
        publishing={false}
        readiness={readiness}
        requiredIncomplete={[]}
        setShowAll={vi.fn()}
        showAll={false}
      />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Finish Setup, 0 of 1 required steps done',
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('uses the launch label when ready but not published', () => {
    render(
      <SetupChecklistMobileDrawer
        compact={false}
        displayItems={[]}
        incompleteItems={[]}
        isOpen={false}
        onOpenChange={vi.fn()}
        onPublish={vi.fn()}
        publishing={false}
        readiness={{ ...readiness, isReady: true }}
        requiredIncomplete={[]}
        setShowAll={vi.fn()}
        showAll={false}
      />
    );

    expect(
      screen.getByRole('button', {
        name: 'Ready to Launch, tap to publish your store',
      })
    ).toBeInTheDocument();
  });

  it('renders nothing when the store is ready and published', () => {
    const { container } = render(
      <SetupChecklistMobileDrawer
        compact={false}
        displayItems={[]}
        incompleteItems={[]}
        isOpen={false}
        onOpenChange={vi.fn()}
        onPublish={vi.fn()}
        publishing={false}
        readiness={{ ...readiness, isReady: true, isPublished: true }}
        requiredIncomplete={[]}
        setShowAll={vi.fn()}
        showAll={false}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
