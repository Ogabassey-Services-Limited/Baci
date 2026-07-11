import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RepairWizardProgressBar } from './RepairWizardProgressBar';

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: ComponentProps<'div'>) => <div {...props} />,
  },
}));

describe('RepairWizardProgressBar', () => {
  it('renders every step title', () => {
    render(<RepairWizardProgressBar currentStep={0} />);

    expect(screen.getByText('Device Details')).toBeInTheDocument();
    expect(screen.getByText('Contact Info')).toBeInTheDocument();
    expect(screen.getByText('Review & Submit')).toBeInTheDocument();
  });

  it('highlights steps up to and including the current step', () => {
    render(<RepairWizardProgressBar currentStep={1} />);

    const contactStep = screen.getByText('Contact Info');
    const reviewStep = screen.getByText('Review & Submit');

    expect(contactStep).toHaveStyle({ color: 'var(--theme-primary, #dc2626)' });
    expect(reviewStep).not.toHaveStyle({
      color: 'var(--theme-primary, #dc2626)',
    });
  });
});
