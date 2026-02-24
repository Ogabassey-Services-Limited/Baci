import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColorPicker } from './color-picker';

describe('ColorPicker', () => {
  it('exports a valid component', () => {
    expect(ColorPicker).toBeDefined();
    expect(typeof ColorPicker).toBe('function');
  });

  it('should mark input as invalid when an invalid hex code is entered', () => {
    const handleChange = vi.fn();
    render(<ColorPicker color="#ffffff" onChange={handleChange} />);

    const input = screen.getByLabelText('Hex Color');

    // Type invalid color
    fireEvent.change(input, { target: { value: 'invalid-color' } });

    // Should have aria-invalid="true"
    expect(input).toHaveAttribute('aria-invalid', 'true');

    // Parent should NOT be called (this is existing behavior, but good to verify)
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('should reset validation when a valid hex code is entered', () => {
    const handleChange = vi.fn();
    render(<ColorPicker color="#ffffff" onChange={handleChange} />);

    const input = screen.getByLabelText('Hex Color');

    // First make it invalid
    fireEvent.change(input, { target: { value: 'invalid' } });
    expect(input).toHaveAttribute('aria-invalid', 'true');

    // Then make it valid
    fireEvent.change(input, { target: { value: '#000000' } });

    // Should NOT have aria-invalid="true"
    expect(input).not.toHaveAttribute('aria-invalid', 'true');

    // Parent SHOULD be called
    expect(handleChange).toHaveBeenCalledWith('#000000');
  });
});
