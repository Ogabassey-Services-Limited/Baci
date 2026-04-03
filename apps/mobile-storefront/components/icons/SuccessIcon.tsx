import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

interface SuccessIconProps {
  size?: number;
  color?: string;
}

export const SuccessIcon = ({
  size = 80,
  color = '#10B981',
}: SuccessIconProps) => {
  const circleProgress = useSharedValue(0);
  const pathProgress = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 100 });
    circleProgress.value = withTiming(1, {
      duration: 600,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
    pathProgress.value = withDelay(
      300,
      withTiming(1, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [circleProgress, pathProgress, scale]);

  const animatedCircleProps = useAnimatedProps(() => {
    const circumference = 2 * Math.PI * 46;
    return {
      strokeDashoffset: circumference * (1 - circleProgress.value),
    };
  });

  const animatedPathProps = useAnimatedProps(() => {
    // strokeDasharray must be >= actual path length (~60); using 100 for clean animation math
    const pathLength = 100;
    return {
      strokeDashoffset: pathLength * (1 - pathProgress.value),
    };
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <Animated.View
      style={[styles.container, { width: size, height: size }, animatedStyle]}
    >
      <Svg viewBox="0 0 100 100" width="100%" height="100%">
        {/* Outer subtle background circle */}
        <Circle
          cx="50"
          cy="50"
          r="46"
          stroke={color}
          strokeWidth="8"
          strokeOpacity="0.15"
          fill="transparent"
        />
        {/* Animated drawing circle */}
        <AnimatedCircle
          cx="50"
          cy="50"
          r="46"
          stroke={color}
          strokeWidth="8"
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={2 * Math.PI * 46}
          animatedProps={animatedCircleProps}
          rotation="-90"
          origin="50, 50"
        />
        {/* Animated checkmark */}
        <AnimatedPath
          d="M 30 50 L 45 65 L 70 35"
          stroke={color}
          strokeWidth="8"
          fill="transparent"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="100"
          animatedProps={animatedPathProps}
        />
      </Svg>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
