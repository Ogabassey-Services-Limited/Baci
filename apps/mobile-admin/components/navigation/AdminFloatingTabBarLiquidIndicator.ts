import {
  cancelAnimation,
  Easing,
  runOnUI,
  type SharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export const ADMIN_LIQUID_TAB_SWITCH_DURATION_MS = 120;

const LIQUID_TAB_SWITCH_TIMING = {
  duration: ADMIN_LIQUID_TAB_SWITCH_DURATION_MS,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const LIQUID_TAB_PULSE_SPRING = {
  damping: 30,
  stiffness: 560,
  mass: 0.46,
};

const LIQUID_TAB_SETTLE_SPRING = {
  damping: 26,
  stiffness: 460,
  mass: 0.5,
};

type NumericSharedValue = SharedValue<number>;

function animateAdminTabIndicatorOnUI(
  nextIndex: number,
  targetIndex: NumericSharedValue,
  animIndex: NumericSharedValue,
  capsuleScale: NumericSharedValue
) {
  'worklet';

  cancelAnimation(animIndex);
  cancelAnimation(capsuleScale);
  targetIndex.value = nextIndex;
  animIndex.value = withTiming(nextIndex, LIQUID_TAB_SWITCH_TIMING);

  capsuleScale.value = withSpring(1.06, LIQUID_TAB_PULSE_SPRING, (finished) => {
    if (finished) {
      capsuleScale.value = withSpring(1, LIQUID_TAB_SETTLE_SPRING);
    }
  });
}

export function animateAdminFloatingTabIndicator(
  nextIndex: number,
  lastTargetIndexRef: { current: number },
  targetIndex: NumericSharedValue,
  animIndex: NumericSharedValue,
  capsuleScale: NumericSharedValue
) {
  lastTargetIndexRef.current = nextIndex;
  runOnUI(animateAdminTabIndicatorOnUI)(
    nextIndex,
    targetIndex,
    animIndex,
    capsuleScale
  );
}
