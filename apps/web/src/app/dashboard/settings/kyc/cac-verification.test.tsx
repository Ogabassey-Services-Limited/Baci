import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const mockFetchWithCsrf = vi.fn();
vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: (...args: unknown[]) => mockFetchWithCsrf(...args),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { CacVerification } from './cac-verification';

const baseProps = {
  verified: false,
  prefillRcNumber: null,
  cacApprovedName: null,
  onVerified: vi.fn(),
};

describe('CacVerification', () => {
  it('shows verified banner with approved name when verified=true', () => {
    // Arrange & Act
    render(
      <CacVerification
        {...baseProps}
        verified={true}
        cacApprovedName="Acme Corp"
      />
    );

    // Assert
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('CAC Verified');
    expect(alert).toHaveTextContent('Acme Corp');
  });

  it('renders search input when verified=false', () => {
    // Arrange & Act
    render(<CacVerification {...baseProps} />);

    // Assert
    expect(screen.getByLabelText(/rc or bn number/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /search cac/i })
    ).toBeInTheDocument();
  });

  it('shows search results after successful search', async () => {
    // Arrange
    const user = userEvent.setup();
    mockFetchWithCsrf.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          companies: [
            {
              approvedName: 'Test Company',
              rcNumber: 'RC-999',
              status: 'ACTIVE',
            },
          ],
        }),
    });
    render(<CacVerification {...baseProps} />);

    // Act
    const input = screen.getByLabelText(/rc or bn number/i);
    await user.type(input, 'RC-999');
    await user.click(screen.getByRole('button', { name: /search cac/i }));

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Test Company')).toBeInTheDocument();
      expect(screen.getByText('RC-999')).toBeInTheDocument();
      expect(screen.getByText('1 result found')).toBeInTheDocument();
    });
  });

  it('pre-fills RC number from props', () => {
    // Arrange & Act
    render(<CacVerification {...baseProps} prefillRcNumber="RC-555" />);

    // Assert
    expect(screen.getByLabelText(/rc or bn number/i)).toHaveValue('RC-555');
  });
});
