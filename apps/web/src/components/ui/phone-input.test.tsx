import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PhoneInput } from './phone-input';

describe('PhoneInput', () => {
  it('should render the country select button with an accessible name', () => {
    render(<PhoneInput value="+1234567890" onChange={() => undefined} />);

    // This should fail initially because there is no aria-label
    // The button contains an SVG flag and an icon, which might not provide a name
    const countrySelectButton = screen.getByRole('button', {
      name: /select country/i,
    });
    expect(countrySelectButton).toBeInTheDocument();
  });
});
