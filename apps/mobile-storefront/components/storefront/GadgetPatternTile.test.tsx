import { render, screen } from '@testing-library/react-native';
import { processColor } from 'react-native';
import Svg from 'react-native-svg';
import { GadgetPatternTile } from './GadgetPatternTile';

function renderTile() {
  render(
    <Svg>
      <GadgetPatternTile
        color="#f8fafc"
        col={2}
        row={1}
        strokeProps={{
          stroke: '#f8fafc',
          strokeWidth: 1.5,
        }}
        tileSize={150}
      />
    </Svg>
  );
}

describe('GadgetPatternTile', () => {
  it('positions the repeated tile at the requested grid coordinates', () => {
    renderTile();

    expect(screen.getByTestId('gadget-pattern-tile-1-2')).toHaveProp(
      'matrix',
      [1, 0, 0, 1, 300, 150]
    );
  });

  it('passes the supplied color to filled decorative primitives', () => {
    renderTile();

    const expectedFill = {
      payload: processColor('#f8fafc'),
      type: 0,
    };

    expect(
      screen.getByTestId('gadget-pattern-laptop-accent-dot-1-2')
    ).toHaveProp('fill', expectedFill);
    expect(
      screen.getByTestId('gadget-pattern-laptop-accent-dot-1-2')
    ).toHaveProp('opacity', 0.6);
  });
});
