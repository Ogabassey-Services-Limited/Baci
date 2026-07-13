import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImeiCheckerIdentifierInput } from './imei-checker-identifier-input';

describe('ImeiCheckerIdentifierInput', () => {
  it('shows the IMEI placeholder and numeric keyboard hint for identifier="imei"', () => {
    render(
      <ImeiCheckerIdentifierInput
        identifier="imei"
        onChange={vi.fn()}
        value=""
      />
    );

    const input = screen.getByLabelText('IMEI number');
    expect(input.getAttribute('placeholder')).toBe(
      'Enter 15-digit IMEI Number'
    );
    expect(input.getAttribute('inputmode')).toBe('numeric');
  });

  it('shows the serial placeholder and default keyboard for identifier="serial"', () => {
    render(
      <ImeiCheckerIdentifierInput
        identifier="serial"
        onChange={vi.fn()}
        value=""
      />
    );

    const input = screen.getByLabelText('Serial number');
    expect(input.getAttribute('placeholder')).toBe('Enter serial number');
    expect(input.getAttribute('inputmode')).toBe('text');
  });

  it('shows the combined placeholder for identifier="both"', () => {
    render(
      <ImeiCheckerIdentifierInput
        identifier="both"
        onChange={vi.fn()}
        value=""
      />
    );

    expect(screen.getByLabelText('IMEI or serial number')).toBeTruthy();
  });

  it('emits the raw typed value on change', () => {
    const onChange = vi.fn();
    render(
      <ImeiCheckerIdentifierInput
        identifier="imei"
        onChange={onChange}
        value=""
      />
    );

    fireEvent.change(screen.getByLabelText('IMEI number'), {
      target: { value: '490154203237518' },
    });

    expect(onChange).toHaveBeenCalledWith('490154203237518');
  });

  it('renders the current value', () => {
    render(
      <ImeiCheckerIdentifierInput
        identifier="imei"
        onChange={vi.fn()}
        value="490154203237518"
      />
    );

    expect(screen.getByLabelText('IMEI number')).toHaveValue(
      '490154203237518'
    );
  });
});
