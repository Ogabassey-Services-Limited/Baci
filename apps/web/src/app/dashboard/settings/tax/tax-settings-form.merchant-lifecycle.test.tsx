import { act, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaxSettingsForm } from './tax-settings-form';

const mockApiPatch = vi.fn();
const mockToast = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
  apiPost: vi.fn(),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));
vi.mock('@/components/address-autocomplete', () => ({
  AddressAutocomplete: (
    props: React.InputHTMLAttributes<HTMLInputElement> & { onSelect?: unknown }
  ) => {
    const { onSelect: _onSelect, ...inputProps } = props;
    return <input {...inputProps} />;
  },
}));

const baseProps = {
  initialLegalEntityName: 'Merchant A Limited',
  initialRegisteredAddress: {
    city: '',
    postal_code: '',
    state: '',
    street: '',
  },
  initialStateCode: '',
  initialTaxId: '',
  initialVatEnabled: false,
  initialVatRate: 7.5,
  merchantId: 'merchant-a',
};

function deferred<T>() {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('TaxSettingsForm merchant lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ignores stale VAT failure after switching A to B and back to A', async () => {
    const request = deferred<unknown>();
    mockApiPatch.mockReturnValueOnce(request.promise);
    const { rerender } = render(<TaxSettingsForm {...baseProps} />);

    fireEvent.click(screen.getByRole('switch'));
    rerender(
      <TaxSettingsForm
        {...baseProps}
        initialVatEnabled={true}
        merchantId="merchant-b"
      />
    );
    rerender(<TaxSettingsForm {...baseProps} />);
    await act(async () => {
      request.reject(new Error('stale VAT failure'));
      await request.promise.catch(() => undefined);
    });

    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('ignores stale legal-name success after switching A to B and back to A', async () => {
    const request = deferred<unknown>();
    mockApiPatch.mockReturnValueOnce(request.promise);
    const { rerender } = render(<TaxSettingsForm {...baseProps} />);
    const legalNameInput = screen.getByLabelText('Registered Business Name');
    const saveButton = legalNameInput.parentElement?.querySelector('button');
    if (!saveButton) throw new Error('Expected legal-name save button');

    fireEvent.click(saveButton);
    rerender(
      <TaxSettingsForm
        {...baseProps}
        initialLegalEntityName="Merchant B Limited"
        merchantId="merchant-b"
      />
    );
    rerender(<TaxSettingsForm {...baseProps} />);
    await act(async () => {
      request.resolve({});
      await request.promise;
    });

    expect(screen.getByLabelText('Registered Business Name')).toHaveValue(
      'Merchant A Limited'
    );
    expect(mockToast).not.toHaveBeenCalled();
  });
});
