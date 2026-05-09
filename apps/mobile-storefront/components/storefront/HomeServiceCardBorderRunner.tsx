import { Animated, StyleSheet } from 'react-native';

type HomeServiceCardBorderRunnerProps = {
  cardHeight: number;
  cardWidth: number;
  color: string;
  progress: Animated.Value;
};

const RUNNER_THICKNESS = 2;
const MIN_HORIZONTAL_LENGTH = 24;
const MAX_HORIZONTAL_LENGTH = 34;
const MIN_VERTICAL_LENGTH = 16;
const MAX_VERTICAL_LENGTH = 22;
const DEFAULT_CARD_WIDTH = 96;
const DEFAULT_CARD_HEIGHT = 36;

const TOP_OPACITY_RANGE = [0, 0.03, 0.22, 0.25, 1];
const TOP_OPACITY_OUTPUT = [0.25, 1, 1, 0, 0];
const RIGHT_OPACITY_RANGE = [0, 0.25, 0.28, 0.47, 0.5, 1];
const RIGHT_OPACITY_OUTPUT = [0, 0, 1, 1, 0, 0];
const BOTTOM_OPACITY_RANGE = [0, 0.5, 0.53, 0.72, 0.75, 1];
const BOTTOM_OPACITY_OUTPUT = [0, 0, 1, 1, 0, 0];
const LEFT_OPACITY_RANGE = [0, 0.75, 0.78, 0.97, 1];
const LEFT_OPACITY_OUTPUT = [0, 0, 1, 1, 0.25];

function sanitizeDimension(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function HomeServiceCardBorderRunner({
  cardHeight,
  cardWidth,
  color,
  progress,
}: HomeServiceCardBorderRunnerProps) {
  const safeCardWidth = sanitizeDimension(cardWidth, DEFAULT_CARD_WIDTH);
  const safeCardHeight = sanitizeDimension(cardHeight, DEFAULT_CARD_HEIGHT);
  const horizontalLength = Math.min(
    Math.max(safeCardWidth * 0.28, MIN_HORIZONTAL_LENGTH),
    MAX_HORIZONTAL_LENGTH
  );
  const verticalLength = Math.min(
    Math.max(safeCardHeight * 0.5, MIN_VERTICAL_LENGTH),
    MAX_VERTICAL_LENGTH
  );
  const maxX = Math.max(safeCardWidth - horizontalLength, 0);
  const maxY = Math.max(safeCardHeight - verticalLength, 0);

  const topOpacity = progress.interpolate({
    inputRange: TOP_OPACITY_RANGE,
    outputRange: TOP_OPACITY_OUTPUT,
    extrapolate: 'clamp',
  });
  const rightOpacity = progress.interpolate({
    inputRange: RIGHT_OPACITY_RANGE,
    outputRange: RIGHT_OPACITY_OUTPUT,
    extrapolate: 'clamp',
  });
  const bottomOpacity = progress.interpolate({
    inputRange: BOTTOM_OPACITY_RANGE,
    outputRange: BOTTOM_OPACITY_OUTPUT,
    extrapolate: 'clamp',
  });
  const leftOpacity = progress.interpolate({
    inputRange: LEFT_OPACITY_RANGE,
    outputRange: LEFT_OPACITY_OUTPUT,
    extrapolate: 'clamp',
  });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.runner,
          styles.top,
          {
            backgroundColor: color,
            opacity: topOpacity,
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 0.25],
                  outputRange: [0, maxX],
                  extrapolate: 'clamp',
                }),
              },
            ],
            width: horizontalLength,
          },
        ]}
        testID="home-service-card-border-top"
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.runner,
          styles.right,
          {
            backgroundColor: color,
            height: verticalLength,
            opacity: rightOpacity,
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0.25, 0.5],
                  outputRange: [0, maxY],
                  extrapolate: 'clamp',
                }),
              },
            ],
          },
        ]}
        testID="home-service-card-border-right"
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.runner,
          styles.bottom,
          {
            backgroundColor: color,
            opacity: bottomOpacity,
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0.5, 0.75],
                  outputRange: [maxX, 0],
                  extrapolate: 'clamp',
                }),
              },
            ],
            width: horizontalLength,
          },
        ]}
        testID="home-service-card-border-bottom"
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.runner,
          styles.left,
          {
            backgroundColor: color,
            height: verticalLength,
            opacity: leftOpacity,
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0.75, 1],
                  outputRange: [maxY, 0],
                  extrapolate: 'clamp',
                }),
              },
            ],
          },
        ]}
        testID="home-service-card-border-left"
      />
    </>
  );
}

const styles = StyleSheet.create({
  runner: {
    position: 'absolute',
    borderRadius: RUNNER_THICKNESS,
    zIndex: 0,
  },
  top: {
    top: 0,
    left: 0,
    height: RUNNER_THICKNESS,
  },
  right: {
    top: 0,
    right: 0,
    width: RUNNER_THICKNESS,
  },
  bottom: {
    bottom: 0,
    left: 0,
    height: RUNNER_THICKNESS,
  },
  left: {
    top: 0,
    left: 0,
    width: RUNNER_THICKNESS,
  },
});
