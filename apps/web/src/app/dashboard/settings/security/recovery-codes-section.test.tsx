import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetStatus } = vi.hoisted(() => ({
  mockGetStatus: vi.fn(),
}));

vi.mock('./recovery-codes-actions', () => ({
  getRecoveryCodesStatusAction: mockGetStatus,
}));
vi.mock('./recovery-codes-card', () => ({
  RecoveryCodesCard: ({ initialCount }: { initialCount: number }) => (
    <div>Recovery codes: {initialCount}</div>
  ),
}));

import {
  RecoveryCodesSection,
  RecoveryCodesSkeleton,
} from './recovery-codes-section';

describe('RecoveryCodesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStatus.mockResolvedValue({ count: 4 });
  });

  it('loads the count in an isolated async section', async () => {
    render(await RecoveryCodesSection());
    expect(screen.getByText('Recovery codes: 4')).toBeInTheDocument();
    expect(mockGetStatus).toHaveBeenCalledTimes(1);
  });

  it('renders a loading skeleton for the Suspense fallback', () => {
    render(<RecoveryCodesSkeleton />);
    expect(screen.getByLabelText('Loading recovery codes')).toBeInTheDocument();
  });
});
