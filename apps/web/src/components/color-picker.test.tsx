import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColorPicker } from './color-picker';

describe('ColorPicker', () => {
  it('exports a valid component', () => {
    expect(ColorPicker).toBeDefined();
    expect(typeof ColorPicker).toBe('function');
  });

  it('shows invalid state when entering invalid hex code', () => {
    const onChange = vi.fn();
    render(<ColorPicker color="#FFFFFF" onChange={onChange} />);

    const input = screen.getByLabelText('Hex Color');

    // Initial state
    expect(input.getAttribute('aria-invalid')).toBe('false');

    // Type invalid hex
    fireEvent.change(input, { target: { value: 'invalid' } });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(onChange).not.toHaveBeenCalled(); // Should not trigger change for invalid color

    // Type valid hex
    fireEvent.change(input, { target: { value: '#000000' } });
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(onChange).toHaveBeenCalledWith('#000000');
  });
});
