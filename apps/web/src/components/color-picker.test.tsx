import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColorPicker } from './color-picker';

describe('ColorPicker', () => {
  it('renders correctly', () => {
    const onChange = vi.fn();
    render(<ColorPicker color="#ff0000" onChange={onChange} />);

    const input = screen.getByLabelText('Hex Color');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('#ff0000');
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  it('updates input value on change', () => {
    const onChange = vi.fn();
    render(<ColorPicker color="#ff0000" onChange={onChange} />);

    const input = screen.getByLabelText('Hex Color');
    fireEvent.change(input, { target: { value: '#00ff00' } });

    expect(input).toHaveValue('#00ff00');
    expect(onChange).toHaveBeenCalledWith('#00ff00');
  });

  it('shows error state for invalid hex', () => {
    const onChange = vi.fn();
    render(<ColorPicker color="#ff0000" onChange={onChange} />);

    const input = screen.getByLabelText('Hex Color');

    // Type invalid hex
    fireEvent.change(input, { target: { value: 'xyz' } });

    expect(input).toHaveValue('xyz');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    // onChange should not be called for invalid input (based on component logic)
    expect(onChange).not.toHaveBeenCalled();

    // Type valid hex again
    fireEvent.change(input, { target: { value: '#0000ff' } });

    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(onChange).toHaveBeenCalledWith('#0000ff');
  });
});
