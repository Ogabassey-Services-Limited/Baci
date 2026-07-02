import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { systemErrorClassNames } from '@/app/system-error-styles';
import { ChunkRecoveryNotice } from './chunk-recovery-notice';

describe('ChunkRecoveryNotice', () => {
  it('renders an accessible status announcing the automatic refresh', () => {
    render(<ChunkRecoveryNotice />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/updating to the latest version/i);
    expect(status).toHaveTextContent(/this page is refreshing automatically/i);
  });

  it('reuses the shared system-error page and card classes instead of parallel hardcoded styles', () => {
    render(<ChunkRecoveryNotice />);

    const status = screen.getByRole('status');
    expect(status).toHaveClass(systemErrorClassNames.page);
    expect(
      status.querySelector(`.${systemErrorClassNames.card}`)
    ).not.toBeNull();
  });

  it('still exposes the status when wrapped in its own document for global-error', () => {
    render(<ChunkRecoveryNotice wrapInDocument />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/updating to the latest version/i);
    expect(status).toHaveTextContent(/this page is refreshing automatically/i);
  });
});
