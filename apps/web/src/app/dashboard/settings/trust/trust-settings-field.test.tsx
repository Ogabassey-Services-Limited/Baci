import { render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { TrustSettingsField } from './trust-settings-field';
import type { TrustFieldConfig } from './trust-settings-fields';
import type { TrustFormValues } from './trust-settings-form-data';

function FieldHarness({
  config,
  withError = false,
}: {
  config: TrustFieldConfig;
  withError?: boolean;
}) {
  const form = useForm<TrustFormValues>({
    defaultValues: { returnMethod: '' } as TrustFormValues,
  });

  useEffect(() => {
    if (withError) {
      form.setError('returnMethod', {
        message: 'Choose how customers can return items',
        type: 'manual',
      });
    }
  }, [form, withError]);

  return <TrustSettingsField config={config} form={form} />;
}

describe('TrustSettingsField', () => {
  it('connects a select validation error to the labelled control', async () => {
    render(
      <FieldHarness
        withError
        config={{
          kind: 'select',
          label: 'Return Method',
          name: 'returnMethod',
          options: [
            { label: 'Select return method', value: '' },
            { label: 'Mail', value: 'mail' },
          ],
        }}
      />
    );

    const select = screen.getByLabelText('Return Method');
    const error = await screen.findByRole('alert');

    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAttribute('aria-describedby', error.id);
    expect(screen.getByRole('option', { name: 'Mail' })).toHaveValue('mail');
  });

  it('renders long-form policy fields as textareas', async () => {
    render(
      <FieldHarness
        config={{
          kind: 'textarea',
          label: 'Warranty Summary',
          name: 'warrantySummary',
          placeholder: 'Manufacturer warranty applies.',
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Warranty Summary')).toHaveAttribute(
        'placeholder',
        'Manufacturer warranty applies.'
      );
    });
    expect(screen.getByLabelText('Warranty Summary').tagName).toBe('TEXTAREA');
  });
});
