import { Platform, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { shouldRenderGadgetPattern } from './should-render-gadget-pattern';

interface GadgetPatternProps {
  opacity?: number;
  height?: number;
  variant?: 'default' | 'tabbar';
  color?: string;
}

const CHIP_PIN_LINES = [
  { x1: '1', y1: '7', x2: '4', y2: '7' },
  { x1: '1', y1: '10', x2: '4', y2: '10' },
  { x1: '1', y1: '13', x2: '4', y2: '13' },
  { x1: '16', y1: '7', x2: '19', y2: '7' },
  { x1: '16', y1: '10', x2: '19', y2: '10' },
  { x1: '16', y1: '13', x2: '19', y2: '13' },
  { x1: '7', y1: '1', x2: '7', y2: '4' },
  { x1: '10', y1: '1', x2: '10', y2: '4' },
  { x1: '13', y1: '1', x2: '13', y2: '4' },
  { x1: '7', y1: '16', x2: '7', y2: '19' },
  { x1: '10', y1: '16', x2: '10', y2: '19' },
  { x1: '13', y1: '16', x2: '13', y2: '19' },
] as const;

export function GadgetPattern({
  opacity = 0.05,
  height = 260,
  variant = 'default',
  color = '#ffffff',
}: GadgetPatternProps) {
  const { width: screenWidth } = useWindowDimensions();

  if (!shouldRenderGadgetPattern(Platform.OS, Platform.Version)) {
    return null;
  }

  const strokeProps = {
    stroke: color,
    strokeWidth: 1.5,
  };

  if (variant === 'tabbar') {
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
          <Circle cx={screenWidth * 0.05} cy={yCenter} r={1.0} fill={color} />

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

          <Circle cx={screenWidth * 0.95} cy={yCenter} r={1.0} fill={color} />
        </G>
      </Svg>
    );
  }

  const tileSize = 150;

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
              {/* Cluster 1 - Top Left: Smartphone */}
              <G transform="translate(20, 20) translate(6, 10) rotate(-15) translate(-6, -10)">
                <Rect
                  x="0"
                  y="0"
                  width="12"
                  height="20"
                  rx="2.5"
                  {...strokeProps}
                />
                <Circle cx="6" cy="16.5" r="1" {...strokeProps} />
                <Line
                  x1="4.5"
                  y1="2.5"
                  x2="7.5"
                  y2="2.5"
                  {...strokeProps}
                  strokeWidth={1}
                  opacity={0.6}
                />
              </G>
              <Path
                d="M40 10 l5 5 l-5 5"
                {...strokeProps}
                strokeWidth={1}
                opacity={0.6}
              />

              {/* Cluster 2 - Top Right: Laptop */}
              <G transform="translate(110, 15) translate(10, 8) rotate(10) translate(-10, -8)">
                <Rect
                  x="2"
                  y="0"
                  width="16"
                  height="10"
                  rx="1.5"
                  {...strokeProps}
                />
                <Path d="M0 11 h20 l-2 3 h-16 z" {...strokeProps} />
              </G>
              <Circle cx="100" cy="30" r="1.5" fill={color} opacity={0.6} />

              {/* Cluster 3 - Center Left: Smart Watch */}
              <G transform="translate(15, 65) translate(8, 8) rotate(-15) translate(-8, -8)">
                <Rect
                  x="6"
                  y="0"
                  width="4"
                  height="16"
                  rx="1"
                  {...strokeProps}
                  opacity={0.5}
                />
                <Rect
                  x="3"
                  y="4"
                  width="10"
                  height="8"
                  rx="2"
                  {...strokeProps}
                />
                <Circle cx="8" cy="8" r="2.5" {...strokeProps} />
              </G>
              <Path
                d="M35 80 l10 0 m-5 -5 l0 10"
                {...strokeProps}
                strokeWidth={1}
                opacity={0.7}
              />

              {/* Cluster 4 - Center Right: CPU Microchip */}
              <G transform="translate(115, 75) translate(10, 10) rotate(45) translate(-10, -10)">
                <Rect
                  x="4"
                  y="4"
                  width="12"
                  height="12"
                  rx="1.5"
                  {...strokeProps}
                />
                {CHIP_PIN_LINES.map((pin) => (
                  <Line
                    key={`chip-pin-${pin.x1}-${pin.y1}-${pin.x2}-${pin.y2}`}
                    {...pin}
                    {...strokeProps}
                    strokeWidth={1}
                  />
                ))}
              </G>

              {/* Cluster 5 - Bottom Left: Headphones */}
              <G transform="translate(25, 115) translate(10, 8) rotate(-20) translate(-10, -8)">
                <Path
                  d="M3 10 A 7 7 0 0 1 17 10"
                  {...strokeProps}
                  fill="none"
                />
                <Rect
                  x="1"
                  y="9"
                  width="3"
                  height="5"
                  rx="1.2"
                  {...strokeProps}
                  fill={color}
                  opacity={0.3}
                />
                <Rect
                  x="16"
                  y="9"
                  width="3"
                  height="5"
                  rx="1.2"
                  {...strokeProps}
                  fill={color}
                  opacity={0.3}
                />
              </G>

              {/* Cluster 6 - Bottom Right: Gamepad */}
              <G transform="translate(90, 115) translate(9, 7) rotate(15) translate(-9, -7)">
                <Rect
                  x="0"
                  y="2"
                  width="18"
                  height="10"
                  rx="4"
                  {...strokeProps}
                />
                {/* D-Pad */}
                <Path d="M3 7 h4 M5 5 v4" {...strokeProps} strokeWidth={0.8} />
                {/* Buttons */}
                <Circle cx="12" cy="8" r="0.8" fill={color} />
                <Circle cx="15" cy="6" r="0.8" fill={color} />
              </G>
              <Circle cx="140" cy="70" r="2" fill={color} opacity={0.8} />
              <Path
                d="M80 50 l3 3 m-3 0 l3 -3"
                {...strokeProps}
                strokeWidth={1}
              />
              <Circle cx="60" cy="100" r="1" fill={color} opacity={0.5} />
            </G>
          ))
        )}
      </G>
    </Svg>
  );
}
