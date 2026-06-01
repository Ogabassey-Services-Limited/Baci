import { useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Rect } from 'react-native-svg';
import { GadgetPatternTile } from './GadgetPatternTile';

interface GadgetPatternProps {
  opacity?: number;
  height?: number;
  variant?: 'default' | 'tabbar';
  color?: string;
}

export function GadgetPattern({
  opacity = 0.05,
  height = 260,
  variant = 'default',
  color = '#ffffff',
}: GadgetPatternProps) {
  const { width: screenWidth } = useWindowDimensions();

  // Explicit stroke properties passed directly to each leaf primitive to bypass react-native-svg inheritance bugs
  const strokeProps = {
    stroke: color,
    strokeWidth: 1.5,
  };

  if (variant === 'tabbar') {
    // Custom row that places elements EXACTLY in the gaps between the 5 tabs:
    // Tab 1: [0 - 20%], Tab 2: [20% - 40%], Tab 3: [40% - 60%], Tab 4: [60% - 80%], Tab 5: [80% - 100%]
    // Gaps are at ~20%, ~40%, ~60%, ~80%
    const yCenter = height / 2;

    const tabbarStrokeProps = {
      stroke: color,
      strokeWidth: 1.0,
    };

    return (
      <Svg
        style={{ position: 'absolute', top: 0, left: 0 }}
        width={screenWidth}
        height={height}
      >
        <G fill="none" opacity={opacity}>
          {/* Subtle circle at 5% */}
          <Circle cx={screenWidth * 0.05} cy={yCenter} r={1.0} fill={color} />

          {/* Gap 1 (20%): Rotated Phone Outline */}
          <G
            transform={`translate(${screenWidth * 0.2 - 4}, ${yCenter - 6.5}) translate(4, 6.5) rotate(-15) translate(-4, -6.5)`}
          >
            <Rect
              x="0"
              y="0"
              width="8"
              height="13"
              rx="1.2"
              {...tabbarStrokeProps}
            />
            <Circle cx="4" cy="10.5" r="0.6" {...tabbarStrokeProps} />
          </G>

          {/* Gap 2 (40%): Rotated Screen Outline */}
          <G
            transform={`translate(${screenWidth * 0.4 - 6}, ${yCenter - 4}) translate(6, 4) rotate(10) translate(-6, -4)`}
          >
            <Rect
              x="0"
              y="0"
              width="12"
              height="8"
              rx="1.2"
              {...tabbarStrokeProps}
            />
            <Line
              x1="2"
              y1="4"
              x2="10"
              y2="4"
              {...tabbarStrokeProps}
              opacity={0.5}
            />
          </G>

          {/* Gap 3 (60%): Rotated Chip Square */}
          <G
            transform={`translate(${screenWidth * 0.6 - 3}, ${yCenter - 3}) translate(3, 3) rotate(45) translate(-3, -3)`}
          >
            <Rect
              x="0"
              y="0"
              width="6"
              height="6"
              rx="0.8"
              {...tabbarStrokeProps}
            />
          </G>

          {/* Gap 4 (80%): Rotated Battery/Camera Outline */}
          <G
            transform={`translate(${screenWidth * 0.8 - 3}, ${yCenter - 5}) translate(3, 5) rotate(15) translate(-3, -5)`}
          >
            <Rect
              x="0"
              y="0"
              width="6"
              height="10"
              rx="1"
              {...tabbarStrokeProps}
            />
          </G>

          {/* Subtle circle at 95% */}
          <Circle cx={screenWidth * 0.95} cy={yCenter} r={1.0} fill={color} />
        </G>
      </Svg>
    );
  }

  // Define the base tile size matching the original pattern
  const tileSize = 150;

  // Calculate columns and rows required to fully cover the Elite backdrop area
  const cols = Math.ceil(screenWidth / tileSize);
  const rows = Math.ceil(height / tileSize);

  const colIndexes = Array.from({ length: cols }, (_, i) => i);
  const rowIndexes = Array.from({ length: rows }, (_, i) => i);

  return (
    <Svg
      style={{ position: 'absolute', top: 0, left: 0 }}
      width={screenWidth}
      height={height}
    >
      <G fill="none" opacity={opacity}>
        {rowIndexes.map((row) =>
          colIndexes.map((col) => (
            <GadgetPatternTile
              key={`${row}-${col}`}
              color={color}
              col={col}
              row={row}
              strokeProps={strokeProps}
              tileSize={tileSize}
            />
          ))
        )}
      </G>
    </Svg>
  );
}
