import type { IoniconsIconName } from '@react-native-vector-icons/ionicons';
import Ionicons from '@react-native-vector-icons/ionicons';
import type { ReactElement, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import { CheckoutSectionCard } from './CheckoutSectionCard';
import type { SelectionColors } from './colors';

interface CollapsibleCheckoutCardProps {
  icon: IoniconsIconName;
  title: string;
  colors: SelectionColors;
  isDark: boolean;
  collapsed: boolean;
  canCollapse: boolean;
  onToggle: () => void;
  /** Rendered when collapsed — the compact receipt of this section. */
  summary: ReactNode;
  /** Rendered when expanded — the editable form. */
  children: ReactNode;
  overflowVisible?: boolean;
  zIndex?: number;
}

/**
 * A CheckoutSectionCard that folds to a summary. The Edit/Done control is
 * neutral (an action, not a selection). Body swaps + reflows animate (~200ms,
 * reduce-motion aware). Collapsing hides the form; entered data is owned by the
 * parent and persists.
 */
export function CollapsibleCheckoutCard({
  icon,
  title,
  colors,
  isDark,
  collapsed,
  canCollapse,
  onToggle,
  summary,
  children,
  overflowVisible,
  zIndex,
}: CollapsibleCheckoutCardProps): ReactElement {
  // Collapsed → a small "Edit" in the header to re-open. Expanded → the primary
  // "Done" moves to the bottom-right of the form (where the thumb ends up after
  // filling), so there is exactly one completion affordance, never two.
  // `canCollapse` false means this section must always stay open. Deriving the
  // effective collapsed state guards against a caller collapsing it into a
  // dead-end summary with no Edit/Done/tap affordance to reopen.
  const isCollapsed = collapsed && canCollapse;

  const editAction = isCollapsed ? (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${title}`}
      style={styles.editBtn}
    >
      <Ionicons name="create-outline" size={16} color={BRAND.primary} />
      <Text style={[styles.editText, { color: BRAND.primary }]}>Edit</Text>
    </Pressable>
  ) : null;

  return (
    <CheckoutSectionCard
      icon={icon}
      title={title}
      colors={colors}
      isDark={isDark}
      action={editAction}
      overflowVisible={overflowVisible}
      zIndex={zIndex}
    >
      <Animated.View layout={LinearTransition.duration(200)}>
        <Animated.View
          key={isCollapsed ? 'summary' : 'body'}
          entering={FadeIn.duration(180)}
        >
          {isCollapsed ? (
            // Tapping anywhere on the collapsed card re-opens it. No explicit
            // label — the summary content becomes the accessible name, so a
            // screen reader announces the entered values plus "button" + hint
            // (and it stays distinct from the header's "Edit {title}" button).
            <Pressable
              onPress={onToggle}
              accessibilityRole="button"
              accessibilityHint={`Reopens the ${title} form to edit it`}
            >
              {summary}
            </Pressable>
          ) : (
            <>
              {children}
              {canCollapse ? (
                <View style={styles.doneRow}>
                  <Pressable
                    onPress={onToggle}
                    accessibilityRole="button"
                    accessibilityLabel={`Done editing ${title}`}
                    style={styles.doneBtn}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={BRAND.primary}
                    />
                    <Text style={styles.doneText}>Done</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
        </Animated.View>
      </Animated.View>
    </CheckoutSectionCard>
  );
}

const styles = StyleSheet.create({
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: SPACING.sm,
  },
  editText: { fontSize: 13, fontWeight: '600' },
  doneRow: { alignItems: 'flex-end', marginTop: SPACING.md },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: BRAND.primaryAlpha06,
  },
  doneText: { fontSize: 14, fontWeight: '700', color: BRAND.primary },
});
