import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { vi } from 'vitest';
import { PhoneInput } from './phone-input';

type MockCountryOption = {
  label: string;
  value: string;
};

type MockCountrySelectProps = {
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: MockCountryOption[];
};

type MockInputComponentProps = React.InputHTMLAttributes<HTMLInputElement>;

type MockPhoneNumberInputProps = {
  className?: string;
  countrySelectComponent?: React.ComponentType<MockCountrySelectProps>;
  inputComponent?: React.ComponentType<MockInputComponentProps>;
  id?: string;
  value?: string;
};

vi.mock('react-phone-number-input', () => {
  const MockPhoneNumberInput = React.forwardRef<
    HTMLDivElement,
    MockPhoneNumberInputProps
  >(
    (
      {
        className,
        countrySelectComponent: CountrySelectComponent,
        inputComponent: InputComponent,
        id,
        value,
      },
      ref
    ) => {
      const options: MockCountryOption[] =
        value === 'EMPTY_OPTIONS'
          ? []
          : [
              { label: 'United States', value: 'US' },
              { label: 'Nigeria', value: 'NG' },
            ];

      const selectedCountryValue = value?.startsWith('+1') ? 'US' : 'ZZ';

      return (
        <div ref={ref} className={className}>
          {InputComponent ? (
            <InputComponent id={id} aria-label="Phone number" />
          ) : null}
          {CountrySelectComponent ? (
            <CountrySelectComponent
              value={selectedCountryValue}
              options={options}
              onChange={() => undefined}
            />
          ) : null}
        </div>
      );
    }
  );

  MockPhoneNumberInput.displayName = 'MockPhoneNumberInput';

  return {
    default: MockPhoneNumberInput,
    getCountryCallingCode: (country: string) => {
      if (country === 'US') return '1';
      if (country === 'NG') return '234';
      return '0';
    },
  };
});

describe('PhoneInput', () => {
  class MockResizeObserver {
    observe() {
      return undefined;
    }

    unobserve() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }
  }

  const originalResizeObserver = globalThis.ResizeObserver;
  const originalScrollIntoView =
    globalThis.HTMLElement.prototype.scrollIntoView;

  beforeAll(() => {
    globalThis.ResizeObserver = MockResizeObserver as typeof ResizeObserver;
    globalThis.HTMLElement.prototype.scrollIntoView = () => undefined;
  });

  afterAll(() => {
    globalThis.ResizeObserver = originalResizeObserver;
    globalThis.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it('renders "Select country" when no country is selected', () => {
    render(<PhoneInput onChange={() => undefined} />);

    expect(
      screen.getByRole('button', { name: 'Select country' })
    ).toBeInTheDocument();
  });

  it('forwards id to the rendered phone number input', () => {
    render(
      <label htmlFor="checkout-phone">
        Phone Number
        <PhoneInput id="checkout-phone" onChange={() => undefined} />
      </label>
    );

    expect(screen.getByLabelText('Phone number')).toHaveAttribute(
      'id',
      'checkout-phone'
    );
  });

  it('renders "Change country: [label]" when a country is selected', () => {
    render(<PhoneInput value="+14155552671" onChange={() => undefined} />);

    expect(
      screen.getByRole('button', { name: 'Change country: United States' })
    ).toBeInTheDocument();
  });

  it('renders the country search input with an explicit aria-label', async () => {
    const user = userEvent.setup();

    render(<PhoneInput value="+14155552671" onChange={() => undefined} />);

    await user.click(
      screen.getByRole('button', { name: 'Change country: United States' })
    );

    expect(await screen.findByLabelText('Search country')).toBeInTheDocument();
  });

  it('shows fallback country label and empty state when there are no options', async () => {
    const user = userEvent.setup();

    render(<PhoneInput value="EMPTY_OPTIONS" onChange={() => undefined} />);

    const trigger = screen.getByRole('button', { name: 'Select country' });
    expect(trigger).toBeInTheDocument();

    await user.click(trigger);

    expect(await screen.findByText('No country found.')).toBeInTheDocument();
  });

  it('announces currently selected option with screen-reader text', async () => {
    const user = userEvent.setup();

    render(<PhoneInput value="+14155552671" onChange={() => undefined} />);

    await user.click(
      screen.getByRole('button', { name: 'Change country: United States' })
    );

    expect(await screen.findByText('Currently selected')).toBeInTheDocument();
  });

  it('opens country picker when pressing Enter on the trigger', async () => {
    const user = userEvent.setup();

    render(<PhoneInput onChange={() => undefined} />);

    const trigger = screen.getByRole('button', { name: 'Select country' });
    trigger.focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByLabelText('Search country')).toBeInTheDocument();
  });

  it('opens country picker when pressing Space on the trigger', async () => {
    const user = userEvent.setup();

    render(<PhoneInput onChange={() => undefined} />);

    const trigger = screen.getByRole('button', { name: 'Select country' });
    trigger.focus();
    await user.keyboard(' ');

    expect(await screen.findByLabelText('Search country')).toBeInTheDocument();
  });
});
