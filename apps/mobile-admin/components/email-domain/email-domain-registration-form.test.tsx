import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmailDomainRegistrationForm } from './email-domain-registration-form';
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

describe('EmailDomainRegistrationForm', () => {
  it('normalizes and submits a valid sending domain', async () => {
    const onSubmit = vi.fn();
    render(
      <EmailDomainRegistrationForm
        colors={colors}
        onSubmit={onSubmit}
        pending={false}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('yourstore.com'), {
      target: { value: '  MyStore.com ' },
    });
    fireEvent.click(screen.getByText('Add domain'));

    await expect.poll(() => onSubmit).toHaveBeenCalledWith('mystore.com');
  });

  it('rejects labels that start with hyphen', async () => {
    const onSubmit = vi.fn();
    render(
      <EmailDomainRegistrationForm
        colors={colors}
        onSubmit={onSubmit}
        pending={false}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('yourstore.com'), {
      target: { value: 'shop.-bad.com' },
    });
    fireEvent.click(screen.getByText('Add domain'));

    await screen.findByText('Enter a valid domain (e.g. mystore.com)');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps a stable accessible name while submitting', () => {
    render(
      <EmailDomainRegistrationForm
        colors={colors}
        onSubmit={vi.fn()}
        pending={true}
      />
    );

    expect(screen.getByRole('button', { name: 'Add domain' })).toBeDisabled();
  });
});
