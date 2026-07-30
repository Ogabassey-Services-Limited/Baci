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

import { NinVerification } from './nin-verification';

const baseProps = {
  merchantId: '11111111-1111-4111-8111-111111111111',
  verified: false,
  prefillNin: null,
  prefillFirstName: null,
  prefillLastName: null,
  prefillDateOfBirth: null,
  onVerified: vi.fn(),
};

describe('NinVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows verified alert when verified=true', () => {
    // Arrange & Act
    render(<NinVerification {...baseProps} verified={true} />);

    // Assert
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Your NIN has been verified.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('renders form fields when verified=false', () => {
    // Arrange & Act
    render(<NinVerification {...baseProps} />);

    // Assert
    expect(screen.getByLabelText(/nin/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /verify nin/i })
    ).toBeInTheDocument();
  });

  it('pre-fills form from props', () => {
    // Arrange
    const props = {
      ...baseProps,
      prefillNin: '12345678901',
      prefillFirstName: 'Jane',
      prefillLastName: 'Doe',
      prefillDateOfBirth: '1990-05-20',
    };

    // Act
    render(<NinVerification {...props} />);

    // Assert
    expect(screen.getByLabelText(/nin/i)).toHaveValue('12345678901');
    expect(screen.getByLabelText(/first name/i)).toHaveValue('Jane');
    expect(screen.getByLabelText(/last name/i)).toHaveValue('Doe');
    expect(screen.getByLabelText(/date of birth/i)).toHaveValue('1990-05-20');
  });

  it('submits the authorized merchant ID with the NIN verification payload', async () => {
    const user = userEvent.setup();
    mockFetchWithCsrf.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ verified: false }),
    });
    render(
      <NinVerification
        {...baseProps}
        prefillDateOfBirth="1990-05-20"
        prefillFirstName="Jane"
        prefillLastName="Doe"
        prefillNin="12345678901"
      />
    );

    await user.click(screen.getByRole('button', { name: /verify nin/i }));

    await waitFor(() => expect(mockFetchWithCsrf).toHaveBeenCalledOnce());
    const [, request] = mockFetchWithCsrf.mock.calls[0] as [
      string,
      { body: string },
    ];
    expect(JSON.parse(request.body)).toMatchObject({
      merchantId: baseProps.merchantId,
      nin: '12345678901',
    });
  });
});
