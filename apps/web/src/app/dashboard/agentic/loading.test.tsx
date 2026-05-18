import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AgenticDashboardLoading from './loading';

describe('AgenticDashboardLoading', () => {
  it('renders an accessible loading state for the agentic dashboard route', () => {
    render(<AgenticDashboardLoading />);

    expect(
      screen.getByRole('status', {
        name: /loading agentic commerce centers/i,
      })
    ).toBeInTheDocument();
  });
});
