import Ionicons, { type IoniconsIconName } from "@react-native-vector-icons/ionicons/static";
import { type Href, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, {
  BRAND,
  palette,
  RADIUS,
  SPACING,
  withAlpha,
} from '@/constants/Colors';
import { HomeServiceCardBorderRunner } from './HomeServiceCardBorderRunner';

type ServiceShortcut = {
  title: string;
  subtitle: string;
  href: Href;
  icon: IoniconsIconName;
  accent: string;
};

type HomeServiceCardsPlacement = 'aboveUtility' | 'belowUtility';

type HomeServiceCardsProps = {
  placement?: HomeServiceCardsPlacement;
};

const SERVICE_SHORTCUTS: ServiceShortcut[] = [
  {
    title: 'IMEI Checker',
    subtitle: 'Verify before buying',
    href: '/imei-check',
    icon: 'barcode-outline',
    accent: BRAND.primary,
  },
  {
    title: 'Repair Lab',
    subtitle: 'Fix phones fast',
    href: '/repairs',
    icon: 'construct-outline',
    accent: palette.amber[500],
  },
  {
    title: 'Swap/Trade',
    subtitle: 'Swap for credit',
    href: '/swap',
    icon: 'swap-horizontal-outline',
    accent: palette.emerald[500],
  },
];

const CARD_HEIGHT = 36;
const COMPACT_CARD_HEIGHT = 34;
const COMPACT_BREAKPOINT = 360;
const CARD_GAP = SPACING.sm;
const BORDER_RUNNER_DURATION = 6570;

export function HomeServiceCards({
  placement = 'belowUtility',
}: HomeServiceCardsProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;
  const rowWidth = Math.max(width - SPACING.md * 2, 0);
  const cardWidth = Math.max((rowWidth - CARD_GAP * 2) / 3, 0);
  const cardHeight = isCompact ? COMPACT_CARD_HEIGHT : CARD_HEIGHT;
  const runnerProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    runnerProgress.setValue(0);
    const animation = Animated.loop(
      Animated.timing(runnerProgress, {
        toValue: 1,
        duration: BORDER_RUNNER_DURATION,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();
    return () => {
      animation.stop();
    };
  }, [runnerProgress]);

  return (
    <View
      style={[
        styles.container,
        placement === 'aboveUtility'
          ? styles.aboveUtility
          : styles.belowUtility,
        { width: rowWidth },
      ]}
      testID="home-service-cards"
      accessibilityLabel="Device services"
    >
      {SERVICE_SHORTCUTS.map((item) => {
        const runnerColor = withAlpha(
          item.accent,
          colorScheme === 'dark' ? 0.94 : 0.86
        );

        return (
          <View
            key={item.href.toString()}
            style={[
              styles.card,
              {
                backgroundColor:
                  colorScheme === 'dark'
                    ? withAlpha(item.accent, 0.08)
                    : withAlpha(item.accent, 0.04),
                borderColor: withAlpha(
                  item.accent,
                  colorScheme === 'dark' ? 0.48 : 0.38
                ),
                width: cardWidth,
              },
              isCompact && styles.compactCard,
            ]}
          >
            <HomeServiceCardBorderRunner
              cardHeight={cardHeight}
              cardWidth={cardWidth}
              color={runnerColor}
              progress={runnerProgress}
            />
            <Pressable
              onPress={() => router.push(item.href)}
              style={styles.cardPressable}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.subtitle}`}
            >
              <View style={styles.cardContent}>
                <Ionicons
                  name={item.icon}
                  size={isCompact ? 15 : 16}
                  color={item.accent}
                  style={styles.icon}
                />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                  style={[
                    styles.title,
                    { color: colors.text },
                    isCompact && styles.compactTitle,
                  ]}
                >
                  {item.title}
                </Text>
              </View>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: CARD_GAP,
  },
  aboveUtility: {
    // Mirrors the tested design variant where the row tucks into the carousel-to-utility gap.
    marginTop: 8,
    marginBottom: -8,
    transform: [{ translateY: -14 }],
  },
  belowUtility: {
    // Preserves the last stable below-utility spacing approved on device.
    marginTop: 28,
    marginBottom: -2,
  },
  card: {
    height: CARD_HEIGHT,
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  cardPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    zIndex: 1,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  compactCard: {
    height: COMPACT_CARD_HEIGHT,
  },
  icon: {
    marginRight: 6,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    lineHeight: 13,
    flexShrink: 1,
  },
  compactTitle: {
    fontSize: 10,
  },
});
