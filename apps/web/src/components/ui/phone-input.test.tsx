import { fireEvent, render, screen } from '@testing-library/react';
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

type MockPhoneNumberInputProps = {
  className?: string;
  countrySelectComponent?: React.ComponentType<MockCountrySelectProps>;
  value?: string;
};

vi.mock('react-phone-number-input', () => {
  const MockPhoneNumberInput = React.forwardRef<
    HTMLDivElement,
    MockPhoneNumberInputProps
  >(
    (
      { className, countrySelectComponent: CountrySelectComponent, value },
      ref
    ) => {
      const options: MockCountryOption[] = [
        { label: 'United States', value: 'US' },
        { label: 'Nigeria', value: 'NG' },
      ];

      const selectedCountryValue = value?.startsWith('+1') ? 'US' : 'ZZ';

      return (
        <div ref={ref} className={className}>
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
    __esModule: true,
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

  it('renders "Change country: [label]" when a country is selected', () => {
    render(<PhoneInput value="+14155552671" onChange={() => undefined} />);

    expect(
      screen.getByRole('button', { name: 'Change country: United States' })
    ).toBeInTheDocument();
  });

  it('renders the country search input with an explicit aria-label', async () => {
    render(<PhoneInput value="+14155552671" onChange={() => undefined} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Change country: United States' })
    );

    expect(await screen.findByLabelText('Search country')).toBeInTheDocument();
  });
});
