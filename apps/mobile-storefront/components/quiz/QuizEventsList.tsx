import { QUIZ_DEFAULT_TIME_PER_QUESTION_SECONDS } from '@baci/shared/constants';
import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { QuizEvent } from '@/services/quiz-types';
import { GadgetPatternBackground } from '../storefront/GadgetPatternBackground';
import type { createQuizLobbyStyles } from './QuizLobby.styles';
import { QuizLobbyEventCard } from './QuizLobbyEventCard';
import { QuizMissionHero } from './QuizMissionHero';
import { QuizRulesModal } from './QuizRulesModal';

type QuizStyles = ReturnType<typeof createQuizLobbyStyles>;

interface QuizEventsListProps {
  events: QuizEvent[];
  isStarting: boolean;
  locale?: string;
  onStart: (eventId: string, termsAccepted?: true) => void;
  resumeEventId?: string | null;
  serverNow?: string;
  styles: QuizStyles;
}

type RulesState = {
  event: QuizEvent;
  requiresAcceptance: boolean;
} | null;

export function QuizEventsList({
  events,
  isStarting,
  locale,
  onStart,
  resumeEventId,
  serverNow,
  styles,
}: QuizEventsListProps) {
  const [rules, setRules] = useState<RulesState>(null);
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.eventsList}>
      <View
        pointerEvents="none"
        style={styles.patternBackground}
        testID="quiz-gadget-pattern-background"
      >
        <GadgetPatternBackground
          backgroundColor={colors.background}
          colorScheme={isDark ? 'dark' : 'light'}
          height={1100}
          opacity={isDark ? 0.1 : 0.09}
        />
      </View>
      <FlatList
        accessibilityLabel="Available quiz events"
        contentContainerStyle={styles.eventsListContent}
        data={events}
        extraData={`${isStarting}:${resumeEventId ?? ''}:${serverNow ?? ''}`}
        keyExtractor={(event) => event.id}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>
              No quiz events available.
            </Text>
            <Text style={styles.emptyStateText}>
              Check back soon for the next chance to play.
            </Text>
          </View>
        }
        ListHeaderComponent={<QuizMissionHero />}
        renderItem={({ item }) => (
          <QuizLobbyEventCard
            event={item}
            isResume={resumeEventId === item.id}
            isStarting={isStarting}
            locale={locale}
            onOpenRules={(requiresAcceptance) =>
              setRules({ event: item, requiresAcceptance })
            }
            onResume={() => setRules({ event: item, requiresAcceptance: true })}
            serverNow={item.serverNow ?? serverNow}
            styles={styles}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
      {rules ? (
        <QuizRulesModal
          eventTitle={rules.event.title}
          onClose={() => setRules(null)}
          onConfirm={() => {
            const eventId = rules.event.id;
            setRules(null);
            onStart(eventId, true);
          }}
          requiresAcceptance={rules.requiresAcceptance}
          timePerQuestionSeconds={
            rules.event.timePerQuestionSeconds ??
            QUIZ_DEFAULT_TIME_PER_QUESTION_SECONDS
          }
          visible
        />
      ) : null}
    </View>
  );
}
