import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/Colors';
import type { FaqItem } from './faq-data';

interface FAQAccordionProps {
  borderColor: string;
  items: readonly FaqItem[];
  onToggle: (id: string) => void;
  expandedId: string | null;
  secondaryTextColor: string;
  textColor: string;
}

export function FAQAccordion({
  borderColor,
  expandedId,
  items,
  onToggle,
  secondaryTextColor,
  textColor,
}: FAQAccordionProps) {
  return (
    <View style={styles.list}>
      {items.map((item) => {
        const isExpanded = expandedId === item.id;

        return (
          <Pressable
            key={item.id}
            style={[
              styles.item,
              {
                borderColor,
              },
            ]}
            onPress={() => onToggle(item.id)}
            accessibilityRole="button"
            accessibilityState={{ expanded: isExpanded }}
            accessibilityLabel={item.question}
            accessibilityHint="Tap to expand or collapse this FAQ item"
          >
            <View style={styles.header}>
              <Text
                style={[styles.question, { color: textColor }]}
                numberOfLines={isExpanded ? undefined : 2}
              >
                {item.question}
              </Text>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={secondaryTextColor}
                accessible={false}
                importantForAccessibility="no"
              />
            </View>
            {isExpanded && (
              <Text style={[styles.answer, { color: secondaryTextColor }]}>
                {item.answer}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: SPACING.sm,
  },
  item: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  question: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.base,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 22,
  },
  answer: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    marginTop: SPACING.sm,
  },
});
