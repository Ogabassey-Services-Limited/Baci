import type React from 'react';
import { useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

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
            transform={`translate(${
              screenWidth * 0.2 - 4
            }, ${yCenter - 6.5}) translate(4, 6.5) rotate(-15) translate(-4, -6.5)`}
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
            transform={`translate(${
              screenWidth * 0.4 - 6
            }, ${yCenter - 4}) translate(6, 4) rotate(10) translate(-6, -4)`}
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
            transform={`translate(${
              screenWidth * 0.6 - 3
            }, ${yCenter - 3}) translate(3, 3) rotate(45) translate(-3, -3)`}
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
            transform={`translate(${
              screenWidth * 0.8 - 3
            }, ${yCenter - 5}) translate(3, 5) rotate(15) translate(-3, -5)`}
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
            <G
              key={`${row}-${col}`}
              transform={`translate(${col * tileSize}, ${row * tileSize})`}
            >
              {/* Cluster 1 - Top Left: Rotated -15deg around (6, 10) */}
              <G transform="translate(20, 20) translate(6, 10) rotate(-15) translate(-6, -10)">
                <Rect
                  x="0"
                  y="0"
                  width="12"
                  height="20"
                  rx="2"
                  {...strokeProps}
                />
                <Circle cx="6" cy="16" r="1" {...strokeProps} />
              </G>
              <Path
                d="M40 10 l5 5 l-5 5"
                {...strokeProps}
                strokeWidth={1}
                opacity={0.6}
              />

              {/* Cluster 2 - Top Right: Rotated 10deg around (9, 6) */}
              <G transform="translate(120, 15) translate(9, 6) rotate(10) translate(-9, -6)">
                <Rect
                  x="0"
                  y="0"
                  width="18"
                  height="12"
                  rx="2"
                  {...strokeProps}
                />
                <Line
                  x1="4"
                  y1="6"
                  x2="14"
                  y2="6"
                  {...strokeProps}
                  opacity={0.5}
                />
              </G>
              <Circle cx="100" cy="30" r="1.5" fill="#ffffff" opacity={0.6} />

              {/* Cluster 3 - Center Left: Rotated 45deg around (5, 5) */}
              <G transform="translate(15, 70) translate(5, 5) rotate(45) translate(-5, -5)">
                <Rect
                  x="0"
                  y="0"
                  width="10"
                  height="10"
                  rx="1"
                  {...strokeProps}
                />
              </G>
              <Path
                d="M35 80 l10 0 m-5 -5 l0 10"
                {...strokeProps}
                strokeWidth={1}
                opacity={0.7}
              />

              {/* Cluster 4 - Center Right: Rotated 5deg around (9, 6) */}
              <G transform="translate(120, 90) translate(9, 6) rotate(5) translate(-9, -6)">
                <Rect
                  x="0"
                  y="3"
                  width="18"
                  height="12"
                  rx="2"
                  {...strokeProps}
                />
                <Circle cx="14" cy="9" r="2" {...strokeProps} />
                <Rect
                  x="2"
                  y="5"
                  width="2"
                  height="8"
                  fill="#ffffff"
                  opacity={0.4}
                />
              </G>

              {/* Cluster 5 - Bottom Left: Rotated -25deg around (10, 6) */}
              <G transform="translate(30, 120) translate(10, 6) rotate(-25) translate(-10, -6)">
                <Circle cx="6" cy="6" r="2" {...strokeProps} />
                <Path
                  d="M0 6 l-4 0 m16 0 l4 0 m-8 -8 l0 -4 m0 16 l0 4"
                  {...strokeProps}
                  strokeWidth={1}
                />
              </G>

              {/* Cluster 6 - Bottom Right: Rotated 15deg around (4, 7) */}
              <G transform="translate(90, 125) translate(4, 7) rotate(15) translate(-4, -7)">
                <Rect
                  x="0"
                  y="0"
                  width="8"
                  height="14"
                  rx="1.5"
                  {...strokeProps}
                />
              </G>
              <Circle cx="140" cy="70" r="2" fill="#ffffff" />
              <Path
                d="M80 50 l3 3 m-3 0 l3 -3"
                {...strokeProps}
                strokeWidth={1}
              />
              <Circle cx="60" cy="100" r="1" fill="#ffffff" opacity={0.5} />
            </G>
          ))
        )}
      </G>
    </Svg>
  );
}
