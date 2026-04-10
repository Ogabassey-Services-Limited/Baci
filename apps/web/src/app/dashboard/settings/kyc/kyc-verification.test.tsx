import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock child verification forms to keep tests focused on the orchestrator
vi.mock('./nin-verification', () => ({
  NinVerification: (props: { verified: boolean }) => (
    <div data-testid="nin-form" data-verified={String(props.verified)} />
  ),
}));

vi.mock('./bvn-verification', () => ({
  BvnVerification: (props: { verified: boolean }) => (
    <div data-testid="bvn-form" data-verified={String(props.verified)} />
  ),
}));

vi.mock('./cac-verification', () => ({
  CacVerification: (props: { verified: boolean }) => (
    <div data-testid="cac-form" data-verified={String(props.verified)} />
  ),
}));

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

import { KycVerification } from './kyc-verification';

const baseProps = {
  verificationStatus: {
    nin_verified: false,
    bvn_verified: false,
    cac_verified: false,
    cac_approved_name: null,
    first_name: 'John',
    last_name: 'Doe',
    date_of_birth: '1990-01-15',
  },
  prefillNin: '12345678901',
  prefillBvn: '22345678901',
  prefillRcNumber: 'RC-123456',
  prefillPhone: '+2348012345678',
};

/** Open all three accordion items so their content is visible in the DOM. */
async function openAllAccordions() {
  const user = userEvent.setup();
  const ninTrigger = screen.getByRole('button', { name: /nin verification/i });
  const bvnTrigger = screen.getByRole('button', { name: /bvn verification/i });
  const cacTrigger = screen.getByRole('button', { name: /cac verification/i });
  await user.click(ninTrigger);
  await user.click(bvnTrigger);
  await user.click(cacTrigger);
}

describe('KycVerification', () => {
  beforeEach(() => {
    mockRefresh.mockClear();
  });

  it('renders the card title and description', () => {
    // Arrange & Act
    render(<KycVerification {...baseProps} />);

    // Assert -- CardTitle renders a <div>, so use getByText
    expect(screen.getByText('KYC Verification')).toBeInTheDocument();
    expect(
      screen.getByText(/verify your identity to enable payment processing/i)
    ).toBeInTheDocument();
  });

  it('renders all three accordion section triggers', () => {
    // Arrange & Act
    render(<KycVerification {...baseProps} />);

    // Assert
    expect(
      screen.getByRole('button', { name: /nin verification/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /bvn verification/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /cac verification/i })
    ).toBeInTheDocument();
  });

  it('shows "Not Started" badges when nothing is verified', () => {
    // Arrange & Act
    render(<KycVerification {...baseProps} />);

    // Assert
    const notStartedBadges = screen.getAllByText('Not Started');
    expect(notStartedBadges).toHaveLength(3);
  });

  it('shows "Verified" badge for NIN when nin_verified is true', () => {
    // Arrange
    const props = {
      ...baseProps,
      verificationStatus: {
        ...baseProps.verificationStatus,
        nin_verified: true,
      },
    };

    // Act
    render(<KycVerification {...props} />);

    // Assert
    const verifiedBadges = screen.getAllByText('Verified');
    expect(verifiedBadges).toHaveLength(1);
    const notStartedBadges = screen.getAllByText('Not Started');
    expect(notStartedBadges).toHaveLength(2);
  });

  it('shows "Verified" badge for BVN when bvn_verified is true', () => {
    // Arrange
    const props = {
      ...baseProps,
      verificationStatus: {
        ...baseProps.verificationStatus,
        bvn_verified: true,
      },
    };

    // Act
    render(<KycVerification {...props} />);

    // Assert
    const verifiedBadges = screen.getAllByText('Verified');
    expect(verifiedBadges).toHaveLength(1);
    const notStartedBadges = screen.getAllByText('Not Started');
    expect(notStartedBadges).toHaveLength(2);
  });

  it('shows "Verified" badge for CAC when cac_verified is true', () => {
    // Arrange
    const props = {
      ...baseProps,
      verificationStatus: {
        ...baseProps.verificationStatus,
        cac_verified: true,
      },
    };

    // Act
    render(<KycVerification {...props} />);

    // Assert
    const verifiedBadges = screen.getAllByText('Verified');
    expect(verifiedBadges).toHaveLength(1);
    const notStartedBadges = screen.getAllByText('Not Started');
    expect(notStartedBadges).toHaveLength(2);
  });

  it('shows all three "Verified" badges when everything is verified', () => {
    // Arrange
    const props = {
      ...baseProps,
      verificationStatus: {
        ...baseProps.verificationStatus,
        nin_verified: true,
        bvn_verified: true,
        cac_verified: true,
      },
    };

    // Act
    render(<KycVerification {...props} />);

    // Assert
    const verifiedBadges = screen.getAllByText('Verified');
    expect(verifiedBadges).toHaveLength(3);
    expect(screen.queryByText('Not Started')).not.toBeInTheDocument();
  });

  it('renders NIN, BVN, and CAC child forms when accordion items are opened', async () => {
    // Arrange
    render(<KycVerification {...baseProps} />);

    // Act -- open all accordion items to reveal content
    await openAllAccordions();

    // Assert
    expect(screen.getByTestId('nin-form')).toBeInTheDocument();
    expect(screen.getByTestId('bvn-form')).toBeInTheDocument();
    expect(screen.getByTestId('cac-form')).toBeInTheDocument();
  });

  it('passes verified status to child form components', async () => {
    // Arrange
    const props = {
      ...baseProps,
      verificationStatus: {
        ...baseProps.verificationStatus,
        nin_verified: true,
        bvn_verified: false,
        cac_verified: true,
      },
    };
    render(<KycVerification {...props} />);

    // Act -- open all accordion items to reveal content
    await openAllAccordions();

    // Assert
    expect(screen.getByTestId('nin-form')).toHaveAttribute(
      'data-verified',
      'true'
    );
    expect(screen.getByTestId('bvn-form')).toHaveAttribute(
      'data-verified',
      'false'
    );
    expect(screen.getByTestId('cac-form')).toHaveAttribute(
      'data-verified',
      'true'
    );
  });

  it('renders the security notice at the bottom', () => {
    // Arrange & Act
    render(<KycVerification {...baseProps} />);

    // Assert
    expect(
      screen.getByText(/your information is encrypted and securely stored/i)
    ).toBeInTheDocument();
  });
});
