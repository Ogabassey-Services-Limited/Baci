import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { BRAND } from '@/constants/Colors';
import { PatternedBackground } from './PatternedBackground';

const mockGadgetPattern = jest.fn(
  (_props: {
    color: string;
    colorScheme: 'light' | 'dark';
    height: number;
    opacity: number;
  }) => <Text>GadgetPattern</Text>
);

jest.mock('./GadgetPattern', () => ({
  GadgetPattern: (props: {
    color: string;
    colorScheme: 'light' | 'dark';
    height: number;
    opacity: number;
  }) => mockGadgetPattern(props),
}));

describe('PatternedBackground', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the light brand pattern over the supplied background', () => {
    render(<PatternedBackground backgroundColor="#FAFAFA" isDark={false} />);

    expect(screen.getByTestId('patterned-background-base')).toHaveStyle({
      backgroundColor: '#FAFAFA',
    });
    expect(mockGadgetPattern).toHaveBeenCalledWith({
      color: BRAND.primary,
      colorScheme: 'light',
      height: 1500,
      opacity: 0.07,
    });
  });

  it('uses the low-opacity white pattern in dark mode', () => {
    render(<PatternedBackground backgroundColor="#111111" isDark={true} />);

    expect(mockGadgetPattern).toHaveBeenCalledWith({
      color: '#ffffff',
      colorScheme: 'dark',
      height: 1500,
      opacity: 0.04,
    });
  });
});
