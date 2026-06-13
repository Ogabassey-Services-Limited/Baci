import './orders-screen-test-utils';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OrdersSectionHeader } from './OrdersSectionHeader';
import { mockColors } from './orders-screen-test-utils';

describe('OrdersSectionHeader', () => {
  it('renders the section title', () => {
    render(<OrdersSectionHeader colors={mockColors} title="Today" />);

    expect(screen.getByText('Today')).toBeInTheDocument();
  });
});
