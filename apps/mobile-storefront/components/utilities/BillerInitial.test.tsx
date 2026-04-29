import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { BillerInitial } from './BillerInitial';

describe('BillerInitial', () => {
  it('renders the uppercase first letter of the biller name', () => {
    render(
      <BillerInitial
        colors={{ border: '#E5E7EB', textSecondary: '#6B7280' }}
        name="ekedc"
      />
    );

    expect(screen.getByText('E')).toBeOnTheScreen();
  });
});
