import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgenticRequestControlsCard } from './agentic-request-controls-card';

describe('AgenticRequestControlsCard', () => {
  it('renders enabled request controls without a refresh error', () => {
    render(
      <AgenticRequestControlsCard
        requestControls={{
          allowlist_count: 2,
          denylist_count: 1,
          fetch_error: false,
          is_agentic_checkout_enabled: true,
        }}
      />
    );

    expect(screen.getByText('Agent checkout enabled')).toBeInTheDocument();
    expect(
      screen.queryByText('Controls could not be refreshed.')
    ).not.toBeInTheDocument();
  });

  it('pluralizes zero and multiple request control counts', () => {
    render(
      <AgenticRequestControlsCard
        requestControls={{
          allowlist_count: 3,
          denylist_count: 0,
          fetch_error: false,
          is_agentic_checkout_enabled: true,
        }}
      />
    );

    expect(screen.getByText('3 trusted patterns')).toBeInTheDocument();
    expect(screen.getByText('0 blocked patterns')).toBeInTheDocument();
  });

  it('renders singular request control counts', () => {
    render(
      <AgenticRequestControlsCard
        requestControls={{
          allowlist_count: 1,
          denylist_count: 1,
          fetch_error: false,
          is_agentic_checkout_enabled: true,
        }}
      />
    );

    expect(screen.getByText('1 trusted pattern')).toBeInTheDocument();
    expect(screen.getByText('1 blocked pattern')).toBeInTheDocument();
  });

  it('renders request control counts and refresh errors', () => {
    render(
      <AgenticRequestControlsCard
        requestControls={{
          allowlist_count: 1,
          denylist_count: 2,
          fetch_error: true,
          is_agentic_checkout_enabled: false,
        }}
      />
    );

    expect(screen.getByText('Request controls')).toBeInTheDocument();
    expect(screen.getByText('Agent checkout disabled')).toBeInTheDocument();
    expect(screen.getByText('1 trusted pattern')).toBeInTheDocument();
    expect(screen.getByText('2 blocked patterns')).toBeInTheDocument();
    expect(
      screen.getByText('Controls could not be refreshed.')
    ).toBeInTheDocument();
  });
});
