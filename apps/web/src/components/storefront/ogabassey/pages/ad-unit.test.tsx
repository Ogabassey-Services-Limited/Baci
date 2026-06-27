import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdUnit } from './ad-unit';

describe('AdUnit', () => {
  it('reserves the configured ad slot dimensions without client JavaScript', () => {
    render(<AdUnit placementKey="FOOTER_BANNER" />);

    const slot = screen.getByText('Footer Banner').parentElement?.parentElement;

    expect(screen.getByText('Sponsored')).toBeInTheDocument();
    expect(screen.getByText('Footer Banner')).toBeInTheDocument();
    expect(screen.getByText('970x250')).toBeInTheDocument();
    expect(slot).toHaveStyle({ height: '250px', maxWidth: '970px' });
  });
});
