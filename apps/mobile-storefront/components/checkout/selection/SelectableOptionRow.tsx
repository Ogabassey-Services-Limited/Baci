import type { IoniconsIconName } from '@react-native-vector-icons/ionicons';
import Ionicons from '@react-native-vector-icons/ionicons';
import type { ReactElement, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import type { SelectionColors } from './colors';
import { SelectionRadio } from './SelectionRadio';

interface SelectableOptionRowProps {
  selected: boolean;
  onPress: () => void;
  colors: SelectionColors;
  title: string;
  disabled?: boolean;
  /** Inside an already-red-bordered ancestor → tint instead of a second border. */
  nested?: boolean;
  /** Rows inside a `colors.card` section card default to `background` for contrast. */
  surface?: 'card' | 'background';
  icon?: IoniconsIconName;
  subtitle?: string;
  /** Right-aligned price / badge. */
  trailing?: ReactNode;
  /** Expanded info, revealed (animated) only while selected. */
  children?: ReactNode;
  accessibilityLabel?: string;
}

/**
 * The one "pick one" primitive for checkout. Single red accent — the border (or
 * a 6% tint when `nested`) plus the SelectionRadio dot; title/subtitle/trailing
 * stay neutral. Expand/collapse and reflow animate (~180ms, reduce-motion aware
 * via Reanimated defaults). Shared by delivery methods, quotes, and saved
 * addresses so selection looks and behaves identically across the step.
 */
export function SelectableOptionRow({
  selected,
  onPress,
  colors,
  title,
  disabled = false,
  nested = false,
  surface = 'background',
  icon,
  subtitle,
  trailing,
  children,
  accessibilityLabel,
}: SelectableOptionRowProps): ReactElement {
  const baseSurface = surface === 'card' ? colors.card : colors.background;

  return (
    <Animated.View
      testID="selectable-option-row"
      layout={LinearTransition.duration(180)}
      style={[
        styles.card,
        {
          backgroundColor:
            selected && nested ? BRAND.primaryAlpha06 : baseSurface,
          borderColor: selected && !nested ? BRAND.primary : colors.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Pressable
        onPress={() => {
          if (!disabled) onPress();
        }}
        disabled={disabled}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected, disabled }}
        accessibilityLabel={accessibilityLabel ?? title}
        style={styles.header}
      >
        {icon ? (
          <View
            style={[
              styles.iconChip,
              { backgroundColor: `${colors.textSecondary}10` },
            ]}
          >
            <Ionicons name={icon} size={22} color={BRAND.primary} />
          </View>
        ) : null}

        <View style={styles.info}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        <SelectionRadio selected={selected} colors={colors} />
      </Pressable>

      {selected && children ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          style={[styles.nested, { borderTopColor: colors.border }]}
        >
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  info: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '700' },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  trailing: { alignItems: 'flex-end' },
  nested: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.xs,
    gap: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
