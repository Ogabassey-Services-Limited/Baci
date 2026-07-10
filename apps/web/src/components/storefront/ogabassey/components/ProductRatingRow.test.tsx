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

  it('renders nothing when the rating is missing', () => {
    const { container } = render(<ProductRatingRow />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    { label: 'zero', rating: 0 },
    { label: 'negative', rating: -1 },
    { label: 'NaN', rating: Number.NaN },
    { label: 'Infinity', rating: Number.POSITIVE_INFINITY },
  ])('renders nothing for a $label rating', ({ rating }) => {
    const { container } = render(<ProductRatingRow rating={rating} />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    { expected: '5', rating: 5 },
    { expected: '5', rating: 6 },
    { expected: '3.5', rating: 3.5 },
  ])('formats $rating as $expected', ({ expected, rating }) => {
    render(<ProductRatingRow rating={rating} />);

    expect(
      screen.getByRole('img', { name: `Rated ${expected} out of 5` })
    ).toBeInTheDocument();
    expect(screen.getByText(`(${expected})`)).toBeInTheDocument();
  });
});
