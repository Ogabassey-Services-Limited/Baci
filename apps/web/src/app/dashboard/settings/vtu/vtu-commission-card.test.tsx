import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VtuCommissionCard } from './vtu-commission-card';

describe('VtuCommissionCard', () => {
  it('renders merchant and platform shares from the configured split', () => {
    render(<VtuCommissionCard commissionRate={40} />);

    expect(screen.getByText('40% split')).toBeInTheDocument();
    expect(screen.getByText('1.2%')).toBeInTheDocument();
    expect(screen.getByText('1.8%')).toBeInTheDocument();
  });
});
