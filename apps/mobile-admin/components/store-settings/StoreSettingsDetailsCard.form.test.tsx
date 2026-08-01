import '@testing-library/jest-dom/vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  callbacks,
  nativeFieldState,
  renderDetailsCard,
  resetDetailsCardMocks,
} from './StoreSettingsDetailsCard.test-helpers';

describe('StoreSettingsDetailsCard form', () => {
  beforeEach(resetDetailsCardMocks);

  it('renders the current values', () => {
    renderDetailsCard();

    expect(screen.getByDisplayValue('Baci Foods')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8012345678')).toBeInTheDocument();
    expect(screen.getByDisplayValue('7000000000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('support@usebaci.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12 Allen Avenue')).toBeInTheDocument();
    expect(screen.getByDisplayValue('baci-foods')).toBeInTheDocument();
    expect(screen.getByText('Nigeria')).toBeInTheDocument();
    expect(screen.getByText('NGN')).toBeInTheDocument();
  });

  it('forwards input changes', () => {
    renderDetailsCard();

    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Baci Stores' },
    });
    const primaryPhoneProps = nativeFieldState.phoneProps[0];
    const supportPhoneProps = nativeFieldState.phoneProps[1];
    act(() => {
      (primaryPhoneProps.onChangeFormattedText as (value: string) => void)(
        '+2348099999999'
      );
      (supportPhoneProps.onChangeFormattedText as (value: string) => void)(
        '+2347111111111'
      );
    });
    fireEvent.change(screen.getByLabelText('Support Email'), {
      target: { value: 'hello@usebaci.com' },
    });
    fireEvent.change(screen.getByLabelText('Business Address'), {
      target: { value: '44 Marina' },
    });
    fireEvent.change(screen.getByLabelText('Store slug'), {
      target: { value: 'baci-stores' },
    });

    expect(callbacks.onBusinessNameChange).toHaveBeenCalledWith('Baci Stores');
    expect(callbacks.onPhoneChange).toHaveBeenCalledWith('+2348099999999');
    expect(callbacks.onSupportPhoneChange).toHaveBeenCalledWith(
      '+2347111111111'
    );
    expect(callbacks.onEmailChange).toHaveBeenCalledWith('hello@usebaci.com');
    expect(callbacks.onAddressChange).toHaveBeenCalledWith('44 Marina');
    expect(callbacks.onSlugChange).toHaveBeenCalledWith('baci-stores');
  });

  it('forwards the country picker action', () => {
    renderDetailsCard();

    fireEvent.click(screen.getByRole('button', { name: 'Select country' }));
    expect(callbacks.onOpenCountryPicker).toHaveBeenCalledTimes(1);
  });

  it('locks the store slug input when the slug is established', () => {
    renderDetailsCard({ slugLocked: true });
    const slugInput = screen.getByLabelText('Store slug');

    expect(slugInput).toHaveAttribute('readonly');
    fireEvent.change(slugInput, { target: { value: 'baci-stores' } });
    expect(callbacks.onSlugChange).not.toHaveBeenCalled();
  });
});
