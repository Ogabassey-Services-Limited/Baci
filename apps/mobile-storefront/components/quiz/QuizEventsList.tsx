import { QUIZ_DEFAULT_TIME_PER_QUESTION_SECONDS } from '@baci/shared/constants';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import type { QuizEvent } from '@/services/quiz-types';
import type { createQuizLobbyStyles } from './QuizLobby.styles';
import { QuizLobbyEventCard } from './QuizLobbyEventCard';
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

  return (
    <View style={styles.eventsList}>
      <FlatList
        accessibilityLabel="Available quiz events"
        contentContainerStyle={styles.eventsListContent}
        data={events}
        extraData={`${isStarting}:${resumeEventId ?? ''}:${serverNow ?? ''}`}
        keyExtractor={(event) => event.id}
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
