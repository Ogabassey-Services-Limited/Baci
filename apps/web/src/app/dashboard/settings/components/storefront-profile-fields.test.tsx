import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import type { SettingsFormValues, settingsSchema } from './settings-utils';
import { StorefrontProfileFields } from './storefront-profile-fields';

function StorefrontProfileFieldsHarness() {
  const form = useForm<
    z.input<typeof settingsSchema>,
    unknown,
    SettingsFormValues
  >({
    defaultValues: {
      business_name: 'Merchant A',
      country: 'NG',
      site_description: 'Quality products for everyday life.',
      support_email: 'support@example.com',
      support_phone: '+2348000000000',
    },
  });

  return <StorefrontProfileFields form={form} />;
}

describe('StorefrontProfileFields', () => {
  it('renders the editable storefront profile at the readiness anchor', () => {
    render(<StorefrontProfileFieldsHarness />);

    expect(screen.getByText('Storefront profile')).toBeInTheDocument();
    expect(screen.getByTestId('storefront-profile')).toBeInTheDocument();
    expect(screen.getByLabelText('Store description')).toHaveValue(
      'Quality products for everyday life.'
    );
    expect(screen.getByLabelText('Public support email')).toHaveValue(
      'support@example.com'
    );
    expect(screen.getByLabelText('Public support phone')).toHaveValue(
      '+2348000000000'
    );
  });

  it('keeps merchant-entered profile changes in the shared settings form', () => {
    render(<StorefrontProfileFieldsHarness />);

    fireEvent.change(screen.getByLabelText('Store description'), {
      target: { value: 'A new merchant description.' },
    });

    expect(screen.getByLabelText('Store description')).toHaveValue(
      'A new merchant description.'
    );
  });
});
