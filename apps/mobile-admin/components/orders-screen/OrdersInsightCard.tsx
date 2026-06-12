import Ionicons from '@react-native-vector-icons/ionicons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { triggerLightHaptic } from '@/components/ui/haptics';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { AiInsight } from '@/hooks/useAiInsights';
import type { ThemeColors, ThemeShadows } from './types';

interface OrdersInsightCardProps {
  visible: boolean;
  colors: ThemeColors;
  shadows: ThemeShadows;
  isLoading: boolean;
  insights: AiInsight[] | undefined;
  pendingCount: number;
  completedTodos: Record<string, boolean>;
  onDismiss: () => void;
  onTodoToggle: (todoText: string, isCompleted: boolean) => void;
  onViewPending: () => void;
}

export function OrdersInsightCard({
  visible,
  colors,
  shadows,
  isLoading,
  insights,
  pendingCount,
  completedTodos,
  onDismiss,
  onTodoToggle,
  onViewPending,
}: OrdersInsightCardProps) {
  if (!visible) return null;

  return (
    <View
      style={[styles.insightCard, { backgroundColor: colors.card }, shadows.sm]}
    >
      <View style={styles.insightHeader}>
        <View
          style={[styles.sparkleIcon, { backgroundColor: colors.goldLight }]}
        >
          <Ionicons name="sparkles" size={14} color={colors.gold} />
        </View>
        <View style={styles.storeInfo}>
          <Text style={[styles.storeName, { color: colors.gold }]}>
            AI INSIGHTS
          </Text>
        </View>
        <Pressable
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Dismiss insight notification"
          accessibilityRole="button"
          style={styles.dismissPressable}
        >
          <View
            style={[
              styles.dismissButton,
              { backgroundColor: colors.backgroundLight },
            ]}
          >
            <Ionicons name="close" size={12} color={colors.textMuted} />
          </View>
        </Pressable>
      </View>
      <InsightBody
        colors={colors}
        isLoading={isLoading}
        insights={insights}
        pendingCount={pendingCount}
        completedTodos={completedTodos}
        onTodoToggle={onTodoToggle}
        onViewPending={onViewPending}
      />
    </View>
  );
}

function InsightBody({
  colors,
  isLoading,
  insights,
  pendingCount,
  completedTodos,
  onTodoToggle,
  onViewPending,
}: Omit<OrdersInsightCardProps, 'visible' | 'shadows' | 'onDismiss'>) {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.gold} size="small" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Analyzing sales context...
        </Text>
      </View>
    );
  }

  if (insights?.length) {
    return (
      <View>
        <View style={styles.primaryInsight}>
          <Text style={[styles.insightTitle, { color: colors.text }]}>
            {insights[0].title}
          </Text>
          <Text
            style={[styles.insightDescription, { color: colors.textSecondary }]}
          >
            {insights[0].description}
          </Text>
        </View>
        <View style={[styles.todoSection, { borderTopColor: colors.border }]}>
          <Text style={[styles.todoHeading, { color: colors.gold }]}>
            TODOS FOR TODAY:
          </Text>
          {insights
            .map((insight) => insight.action)
            .filter((todoText): todoText is string => Boolean(todoText))
            .map((todoText) => (
              <InsightTodo
                key={todoText}
                colors={colors}
                todoText={todoText}
                isCompleted={!!completedTodos[todoText]}
                onToggle={onTodoToggle}
              />
            ))}
        </View>
      </View>
    );
  }

  return (
    <View>
      <Text style={[styles.insightMessage, { color: colors.textSecondary }]}>
        You have {pendingCount} pending orders awaiting confirmation. Process
        them to keep customers happy!
      </Text>
      <Pressable
        style={styles.insightLink}
        onPress={onViewPending}
        accessibilityLabel={`View ${pendingCount} pending orders`}
        accessibilityRole="button"
        accessibilityHint="Filters orders to show only pending orders"
      >
        <Text style={[styles.insightLinkText, { color: colors.gold }]}>
          View pending
        </Text>
        <Ionicons name="arrow-forward" size={14} color={colors.gold} />
      </Pressable>
    </View>
  );
}

function InsightTodo({
  colors,
  todoText,
  isCompleted,
  onToggle,
}: {
  colors: ThemeColors;
  todoText: string;
  isCompleted: boolean;
  onToggle: (todoText: string, isCompleted: boolean) => void;
}) {
  return (
    <Pressable
      style={styles.todoItem}
      onPress={() => {
        triggerLightHaptic();
        onToggle(todoText, isCompleted);
      }}
      accessibilityLabel={`Todo item: ${todoText}. ${isCompleted ? 'Completed' : 'Not completed'}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isCompleted }}
    >
      <Ionicons
        name={isCompleted ? 'checkbox' : 'square-outline'}
        size={18}
        color={isCompleted ? colors.success : colors.textMuted}
      />
      <Text
        style={[
          styles.todoText,
          {
            color: isCompleted ? colors.textMuted : colors.textSecondary,
            textDecorationLine: isCompleted ? 'line-through' : 'none',
          },
        ]}
      >
        {todoText}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  insightCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  sparkleIcon: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeInfo: { flex: 1, marginLeft: SPACING.sm },
  storeName: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  dismissPressable: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissButton: {
    width: 20,
    height: 20,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: { paddingVertical: SPACING.md, alignItems: 'center' },
  loadingText: {
    fontSize: TYPOGRAPHY.size.xs,
    marginTop: SPACING.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  primaryInsight: { marginBottom: SPACING.sm },
  insightTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: 4,
  },
  insightDescription: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: 18,
  },
  todoSection: { borderTopWidth: 1, paddingTop: SPACING.sm },
  todoHeading: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: 4,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: SPACING.sm,
  },
  todoText: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  insightMessage: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  insightLink: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  insightLinkText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
