import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreReadiness } from '@/app/api/merchant/readiness/route';
import { SetupChecklist } from './setup-checklist';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: ReactNode }) => <>{children}</>,
  SheetContent: () => null,
  SheetDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  SheetTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/merchant-publish-client', () => ({
  requestMerchantPublish: vi.fn(),
}));

const readiness = {
  isReady: false,
  isPublished: false,
  completedRequired: 0,
  totalRequired: 5,
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
      id: 'payments',
      label: 'Add payment method',
      description: 'Connect a payment provider.',
      completed: false,
      href: '/dashboard/payments',
      priority: 'required',
      category: 'payments',
    },
    {
      id: 'products',
      label: 'Add products',
      description: 'Create your first products.',
      completed: false,
      href: '/dashboard/products',
      priority: 'required',
      category: 'products',
    },
    {
      id: 'store',
      label: 'Customize storefront',
      description: 'Set up your storefront branding.',
      completed: false,
      href: '/builder',
      priority: 'required',
      category: 'store',
    },
    {
      id: 'legal',
      label: 'Complete business profile',
      description: 'Add required business details.',
      completed: false,
      href: '/dashboard/settings',
      priority: 'required',
      category: 'legal',
    },
    {
      id: 'marketing',
      label: 'Add marketing pixels',
      description: 'Configure optional tracking.',
      completed: false,
      href: '/dashboard/marketing',
      priority: 'optional',
      category: 'marketing',
    },
  ],
} satisfies StoreReadiness;

describe('SetupChecklist', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => readiness,
    } as Response);
  });

  it('announces the collapsed and expanded state of the setup item toggle', async () => {
    render(<SetupChecklist compact />);

    const toggle = await screen.findByRole('button', {
      name: 'Show 2 more setup items',
    });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    act(() => {
      fireEvent.click(toggle);
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Show fewer setup items' })
      ).toHaveAttribute('aria-expanded', 'true');
    });
  });
});
