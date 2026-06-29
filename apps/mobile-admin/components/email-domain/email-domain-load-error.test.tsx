import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmailDomainLoadError } from './email-domain-load-error';
import type { EmailDomainColors } from './email-domain-settings.styles';

const colors: EmailDomainColors = {
  background: '#fff',
  border: '#eee',
  card: '#fafafa',
  error: '#d00',
  errorLight: '#fee',
  info: '#06c',
  infoLight: '#def',
  primary: '#25f',
  success: '#1a3',
  successLight: '#dfd',
  text: '#012',
  textMuted: '#678',
  textSecondary: '#345',
} as EmailDomainColors;

describe('EmailDomainLoadError', () => {
  it('surfaces the query error and retries', () => {
    const onRetry = vi.fn();
    render(
      <EmailDomainLoadError
        colors={colors}
        error={new Error('network unavailable')}
        refreshing={false}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText('network unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('keeps an accessible name while refreshing (spinner replaces the label)', () => {
    render(
      <EmailDomainLoadError
        colors={colors}
        error={new Error('network unavailable')}
        refreshing={true}
        onRetry={vi.fn()}
      />
    );

    // The visible "Retry" text is swapped for a spinner, so the button must
    // still expose a stable accessible name for screen readers.
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
