import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnsurePermission = vi.fn();
const mockIsMerchantPermissionRedirectError = vi.fn((error: unknown) => {
  return (
    error instanceof Error && error.message.startsWith('Permission denied:')
  );
});
const mockRedirect = vi.fn((target: string) => {
  throw new Error(`NEXT_REDIRECT:${target}`);
});

vi.mock('next/navigation', () => ({
  redirect: (target: string) => mockRedirect(target),
}));

vi.mock('@/lib/merchant-server', () => ({
  ensurePermission: (...args: unknown[]) => mockEnsurePermission(...args),
  isMerchantPermissionRedirectError: (error: unknown) =>
    mockIsMerchantPermissionRedirectError(error),
}));

vi.mock('./quiz-admin-client', () => ({
  QuizAdminClient: () => <div>Quiz admin client</div>,
}));

const { default: QuizDashboardPage } = await import('./page');

describe('QuizDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsMerchantPermissionRedirectError.mockImplementation(
      (error: unknown) => {
        return (
          error instanceof Error &&
          error.message.startsWith('Permission denied:')
        );
      }
    );
    mockEnsurePermission.mockResolvedValue({ merchant: { id: 'merchant-1' } });
  });

  it('requires marketing edit permission before rendering the generator', async () => {
    await QuizDashboardPage();

    expect(mockEnsurePermission).toHaveBeenCalledWith('marketing', 'edit');
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('redirects when the merchant cannot edit marketing content', async () => {
    mockEnsurePermission.mockRejectedValueOnce(
      new Error('Permission denied: edit access to marketing is required')
    );

    await expect(QuizDashboardPage()).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard'
    );
    expect(mockIsMerchantPermissionRedirectError).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });

  it('does not mask operational permission-loading failures', async () => {
    mockEnsurePermission.mockRejectedValueOnce(
      new Error('Database unavailable')
    );

    await expect(QuizDashboardPage()).rejects.toThrow('Database unavailable');
    expect(mockIsMerchantPermissionRedirectError).toHaveBeenCalledOnce();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
