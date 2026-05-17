import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImeiCheckerFindImei } from './imei-checker-find-imei';

describe('ImeiCheckerFindImei', () => {
  it('renders IMEI lookup instructions with themed step markers', () => {
    render(<ImeiCheckerFindImei />);

    expect(screen.getByText('How to find your IMEI:')).toBeInTheDocument();
    expect(screen.getByText('Dial *#06#')).toBeInTheDocument();
    expect(screen.getByText('Copy the 15-digit number')).toBeInTheDocument();
    expect(screen.getByText('Paste above & verify')).toBeInTheDocument();
    expect(screen.getByText('1')).toHaveClass(
      'bg-[var(--store-primary)]/10',
      'text-[var(--store-primary)]'
    );
  });
});
