import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchWithCsrf = vi.fn();
vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: (...args: unknown[]) => mockFetchWithCsrf(...args),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { CacVerification } from './cac-verification';

const baseProps = {
  merchantId: '11111111-1111-4111-8111-111111111111',
  verified: false,
  prefillRcNumber: null,
  cacApprovedName: null,
  onVerified: vi.fn(),
};

describe('CacVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows verified banner with approved name when verified=true', () => {
    // Arrange & Act
    render(
      <CacVerification {...baseProps} verified cacApprovedName="Acme Corp" />
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

  it('submits the authorized merchant ID with the CAC certificate upload', async () => {
    const user = userEvent.setup();
    mockFetchWithCsrf
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ verified: false }),
      });
    render(<CacVerification {...baseProps} />);

    await user.type(screen.getByLabelText(/rc or bn number/i), 'RC-999');
    await user.click(screen.getByRole('button', { name: /search cac/i }));
    await user.click(await screen.findByText('Test Company'));
    await user.click(
      screen.getByRole('button', { name: /confirm.*upload certificate/i })
    );
    await user.upload(
      screen.getByLabelText(/cac certificate file upload/i),
      new File(['certificate'], 'certificate.pdf', { type: 'application/pdf' })
    );
    await user.click(
      screen.getByRole('button', { name: /verify certificate/i })
    );

    await waitFor(() => expect(mockFetchWithCsrf).toHaveBeenCalledTimes(2));
    const [, request] = mockFetchWithCsrf.mock.calls[1] as [
      string,
      { body: FormData },
    ];
    expect(request.body.get('merchantId')).toBe(baseProps.merchantId);
  });
});
