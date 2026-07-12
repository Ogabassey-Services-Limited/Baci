import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RepairsUnavailable from './repairs-unavailable';

describe('RepairsUnavailable', () => {
  it('explains a missing permission', () => {
    render(<RepairsUnavailable reason="permission" />);
    expect(screen.getByText('No access to repairs')).toBeInTheDocument();
  });

  it('explains an ineligible business type', () => {
    render(<RepairsUnavailable reason="business-type" />);
    expect(
      screen.getByText('Repairs is for electronics stores')
    ).toBeInTheDocument();
  });

  it('prompts to enable the disabled catalogue', () => {
    render(<RepairsUnavailable reason="disabled" />);
    expect(screen.getByText('Repairs catalogue is off')).toBeInTheDocument();
  });
});
