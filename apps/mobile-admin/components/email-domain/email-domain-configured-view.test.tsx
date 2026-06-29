import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmailDomainConfiguredView } from './email-domain-configured-view';
import type { EmailDomainColors } from './email-domain-settings.styles';

vi.mock('@react-native-vector-icons/ionicons', () => ({ default: () => null }));

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

describe('EmailDomainConfiguredView', () => {
  it('shows recovery guidance for failed verification', () => {
    render(
      <EmailDomainConfiguredView
        colors={colors}
        config={{
          domain: 'mystore.com',
          senderLocalPart: 'noreply',
          status: 'failed',
          enabled: false,
          records: [],
        }}
        onCopy={vi.fn()}
        onVerify={vi.fn()}
        verifying={false}
        onToggle={vi.fn()}
        toggling={false}
        onReplace={vi.fn()}
      />
    );

    expect(screen.getByText('Verification failed')).toBeInTheDocument();
    expect(screen.getByText(/Check that the DKIM TXT/)).toBeInTheDocument();
  });

  it('keeps the verify button name and state while verifying', () => {
    render(
      <EmailDomainConfiguredView
        colors={colors}
        config={{
          domain: 'mystore.com',
          senderLocalPart: 'noreply',
          status: 'pending',
          enabled: false,
          records: [],
        }}
        onCopy={vi.fn()}
        onVerify={vi.fn()}
        verifying={true}
        onToggle={vi.fn()}
        toggling={false}
        onReplace={vi.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Verify DNS records' })
    ).toBeDisabled();
  });

  it('copies DNS record hosts and values', () => {
    const onCopy = vi.fn();
    render(
      <EmailDomainConfiguredView
        colors={colors}
        config={{
          domain: 'mystore.com',
          senderLocalPart: 'noreply',
          status: 'pending',
          enabled: false,
          records: [{ type: 'TXT', host: 'h', value: 'v' }],
        }}
        onCopy={onCopy}
        onVerify={vi.fn()}
        verifying={false}
        onToggle={vi.fn()}
        toggling={false}
        onReplace={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy TXT host' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy TXT value' }));

    expect(onCopy).toHaveBeenNthCalledWith(1, 'h');
    expect(onCopy).toHaveBeenNthCalledWith(2, 'v');
  });

  it('lets the merchant replace a pending or failed domain', () => {
    const onReplace = vi.fn();
    render(
      <EmailDomainConfiguredView
        colors={colors}
        config={{
          domain: 'mystore.com',
          senderLocalPart: 'noreply',
          status: 'failed',
          enabled: false,
          records: [],
        }}
        onCopy={vi.fn()}
        onVerify={vi.fn()}
        verifying={false}
        onToggle={vi.fn()}
        toggling={false}
        onReplace={onReplace}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Use a different domain' })
    );
    expect(onReplace).toHaveBeenCalledTimes(1);
  });

  it('hides the replace action once the domain is verified', () => {
    render(
      <EmailDomainConfiguredView
        colors={colors}
        config={{
          domain: 'mystore.com',
          senderLocalPart: 'noreply',
          status: 'verified',
          enabled: true,
          records: [],
        }}
        onCopy={vi.fn()}
        onVerify={vi.fn()}
        verifying={false}
        onToggle={vi.fn()}
        toggling={false}
        onReplace={vi.fn()}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Use a different domain' })
    ).not.toBeInTheDocument();
  });
});
