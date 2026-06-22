import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  useOgabasseyPdpCriticalCommerce,
  useOptionalOgabasseyPdpCriticalCommerce,
} from './critical-commerce-state-context.client';

function RequiredCommerceProbe() {
  useOgabasseyPdpCriticalCommerce();
  return null;
}

function OptionalCommerceProbe() {
  const commerce = useOptionalOgabasseyPdpCriticalCommerce();
  return <p>{commerce ? 'present' : 'missing'}</p>;
}

describe('critical commerce state context', () => {
  it('throws a clear error for required consumers outside the provider', () => {
    expect(() => render(<RequiredCommerceProbe />)).toThrow(
      /must be rendered inside OgabasseyPdpCriticalCommerceProvider/
    );
  });

  it('allows optional consumers outside the provider', () => {
    render(<OptionalCommerceProbe />);

    expect(screen.getByText('missing')).toBeInTheDocument();
  });
});
