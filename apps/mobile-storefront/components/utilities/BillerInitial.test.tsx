import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { BillerInitial } from '@/components/utilities/BillerInitial';

const DEFAULT_COLORS = { border: '#E5E7EB', textSecondary: '#6B7280' };

describe('BillerInitial', () => {
  it('renders the uppercase first letter of the biller name', () => {
    render(<BillerInitial colors={DEFAULT_COLORS} name="ekedc" />);

    expect(screen.getByText('E')).toBeOnTheScreen();
  });

  it('renders a fallback initial for whitespace-only names', () => {
    render(<BillerInitial colors={DEFAULT_COLORS} name="   " />);

    expect(screen.getByText('?')).toBeOnTheScreen();
  });

  it('renders a fallback initial for empty names', () => {
    render(<BillerInitial colors={DEFAULT_COLORS} name="" />);

    expect(screen.getByText('?')).toBeOnTheScreen();
  });

  it('renders the first input character when it is numeric or symbolic', () => {
    render(<BillerInitial colors={DEFAULT_COLORS} name="9mobile" />);

    expect(screen.getByText('9')).toBeOnTheScreen();
  });

  it('applies controlled circle and text colors', () => {
    render(
      <BillerInitial
        colors={{ border: '#111827', textSecondary: '#F9FAFB' }}
        name="ekedc"
      />
    );

    expect(screen.getByLabelText('Biller: ekedc')).toHaveStyle({
      backgroundColor: '#111827',
    });
    expect(screen.getByText('E')).toHaveStyle({
      color: '#F9FAFB',
    });
  });

  it('lets the parent control circle spacing through style', () => {
    render(
      <BillerInitial
        colors={DEFAULT_COLORS}
        name="ekedc"
        style={{ marginBottom: 12 }}
      />
    );

    expect(screen.getByLabelText('Biller: ekedc')).toHaveStyle({
      marginBottom: 12,
    });
  });
});
