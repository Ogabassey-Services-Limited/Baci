import type { WebStoreReadiness } from '@baci/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestMerchantPublish } from '@/lib/merchant-publish-client';
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

function getReadiness(merchantId: string, isReady = false): WebStoreReadiness {
  return {
    merchantId,
    surface: 'web',
    isReady,
    isPublished: false,
    completedRequired: isReady ? 1 : 0,
    totalRequired: 1,
    completedRecommended: 0,
    totalRecommended: 0,
    overallProgress: isReady ? 100 : 0,
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
        label: `Add payment method for ${merchantId}`,
        description: 'Connect a payment provider.',
        completed: isReady,
        priority: 'required',
        category: 'payments',
      },
    ],
  };
}

describe('SetupChecklist merchant scope', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the selected merchant for readiness and publishing', async () => {
    const selectedMerchantId = 'merchant-b';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => getReadiness(selectedMerchantId, true),
    } as Response);
    vi.mocked(requestMerchantPublish).mockResolvedValue(new Response('{}'));

    render(<SetupChecklist merchantId={selectedMerchantId} compact />);

    await screen.findByRole('button', { name: 'Publish Store' });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `/api/merchant/readiness?merchantId=${selectedMerchantId}`,
      { cache: 'no-store' }
    );

    fireEvent.click(screen.getByRole('button', { name: 'Publish Store' }));

    await waitFor(() => {
      expect(requestMerchantPublish).toHaveBeenCalledWith(
        selectedMerchantId,
        false
      );
    });
  });

  it('clears merchant A readiness before showing merchant B readiness', async () => {
    let resolveMerchantA: ((value: Response) => void) | undefined;
    const merchantARequest = new Promise<Response>((resolve) => {
      resolveMerchantA = resolve;
    });
    const merchantB = getReadiness('merchant-b');
    vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(merchantARequest)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => merchantB,
      } as Response);

    const { rerender } = render(
      <SetupChecklist merchantId="merchant-a" compact />
    );

    rerender(<SetupChecklist merchantId="merchant-b" compact />);

    expect(screen.queryByText('Add payment method for merchant-a')).toBeNull();
    expect(
      await screen.findByText('Add payment method for merchant-b')
    ).toBeVisible();
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      '/api/merchant/readiness?merchantId=merchant-b',
      { cache: 'no-store' }
    );

    resolveMerchantA?.({
      ok: true,
      json: async () => getReadiness('merchant-a'),
    } as Response);

    await waitFor(() => {
      expect(
        screen.queryByText('Add payment method for merchant-a')
      ).toBeNull();
    });
  });
});
