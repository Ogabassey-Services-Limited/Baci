import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductRatingRow } from './ProductRatingRow';

describe('ProductRatingRow', () => {
  it('renders a stable accessible rating row', () => {
    render(<ProductRatingRow rating={4.8} />);

    expect(
      screen.getByRole('img', { name: 'Rated 4.8 out of 5' })
    ).toBeInTheDocument();
    expect(screen.getByText('(4.8)')).toBeInTheDocument();
  });

  it('normalizes missing ratings to zero without unstable text', () => {
    render(<ProductRatingRow />);

    expect(
      screen.getByRole('img', { name: 'Rated 0 out of 5' })
    ).toBeInTheDocument();
    expect(screen.getByText('(0)')).toBeInTheDocument();
  });

  it.each([
    { expected: '0', rating: -1 },
    { expected: '0', rating: 0 },
    { expected: '0', rating: Number.NaN },
    { expected: '0', rating: Number.POSITIVE_INFINITY },
    { expected: '5', rating: 5 },
    { expected: '5', rating: 6 },
  ])('formats $rating as $expected', ({ expected, rating }) => {
    render(<ProductRatingRow rating={rating} />);

    expect(
      screen.getByRole('img', { name: `Rated ${expected} out of 5` })
    ).toBeInTheDocument();
    expect(screen.getByText(`(${expected})`)).toBeInTheDocument();
  });
});
