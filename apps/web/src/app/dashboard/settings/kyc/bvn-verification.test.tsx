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

import { BvnVerification } from './bvn-verification';

const baseProps = {
  merchantId: '11111111-1111-4111-8111-111111111111',
  verified: false,
  prefillBvn: null,
  prefillFirstName: null,
  prefillLastName: null,
  prefillDateOfBirth: null,
  prefillPhone: null,
  onVerified: vi.fn(),
};

describe('BvnVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows verified alert when verified=true', () => {
    // Arrange & Act
    render(<BvnVerification {...baseProps} verified={true} />);

    // Assert
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Your BVN has been verified.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('renders form fields including mobile number when verified=false', () => {
    // Arrange & Act
    render(<BvnVerification {...baseProps} />);

    // Assert
    expect(screen.getByLabelText(/bvn/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mobile number/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /verify bvn/i })
    ).toBeInTheDocument();
  });

  it('pre-fills form from props', () => {
    // Arrange
    const props = {
      ...baseProps,
      prefillBvn: '22345678901',
      prefillFirstName: 'John',
      prefillLastName: 'Smith',
      prefillDateOfBirth: '1985-12-01',
      prefillPhone: '08012345678',
    };

    // Act
    render(<BvnVerification {...props} />);

    // Assert
    expect(screen.getByLabelText(/bvn/i)).toHaveValue('22345678901');
    expect(screen.getByLabelText(/first name/i)).toHaveValue('John');
    expect(screen.getByLabelText(/last name/i)).toHaveValue('Smith');
    expect(screen.getByLabelText(/date of birth/i)).toHaveValue('1985-12-01');
    expect(screen.getByLabelText(/mobile number/i)).toHaveValue('08012345678');
  });

  it('submits the authorized merchant ID with the BVN verification payload', async () => {
    const user = userEvent.setup();
    mockFetchWithCsrf.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ verified: false }),
    });
    render(
      <BvnVerification
        {...baseProps}
        prefillBvn="22345678901"
        prefillDateOfBirth="1985-12-01"
        prefillFirstName="John"
        prefillLastName="Smith"
        prefillPhone="08012345678"
      />
    );

    await user.click(screen.getByRole('button', { name: /verify bvn/i }));

    await waitFor(() => expect(mockFetchWithCsrf).toHaveBeenCalledOnce());
    const [, request] = mockFetchWithCsrf.mock.calls[0] as [
      string,
      { body: string },
    ];
    expect(JSON.parse(request.body)).toMatchObject({
      merchantId: baseProps.merchantId,
      bvn: '22345678901',
    });
  });
});
