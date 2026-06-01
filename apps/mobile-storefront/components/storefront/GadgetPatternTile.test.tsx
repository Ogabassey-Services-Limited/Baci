import type { ReactElement } from 'react';
import { GadgetPatternTile } from './GadgetPatternTile';

type TileElement = ReactElement<{
  children: ReactElement[];
  transform: string;
}>;

function renderTile() {
  return GadgetPatternTile({
    color: '#f8fafc',
    col: 2,
    row: 1,
    strokeProps: {
      stroke: '#f8fafc',
      strokeWidth: 1.5,
    },
    tileSize: 150,
  }) as TileElement;
}

describe('GadgetPatternTile', () => {
  it('positions the repeated tile at the requested grid coordinates', () => {
    expect(renderTile().props.transform).toBe('translate(300, 150)');
  });

  it('passes the supplied color to filled decorative primitives', () => {
    const tileChildren = renderTile().props.children;
    const laptopAccentDot = tileChildren[3];

    expect(laptopAccentDot.props).toMatchObject({
      fill: '#f8fafc',
      opacity: 0.6,
    });
  });
});
