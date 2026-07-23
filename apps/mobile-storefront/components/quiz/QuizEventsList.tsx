import { Pressable, Text, View } from 'react-native';
import type { QuizEvent } from '@/services/quiz-types';
import type { createQuizStyles } from './QuizScreen.styles';
import { formatTimeRange, getEventStartButtonText } from './QuizScreen.utils';

type QuizStyles = ReturnType<typeof createQuizStyles>;

interface QuizEventsListProps {
  events: QuizEvent[];
  isStarting: boolean;
  locale?: string;
  onStart: (eventId: string) => void;
  styles: QuizStyles;
  timeNotSetLabel: string;
}

export function QuizEventsList({
  events,
  isStarting,
  locale,
  onStart,
  styles,
  timeNotSetLabel,
}: QuizEventsListProps) {
  return (
    <View accessibilityRole="list" accessibilityLabel="Available quiz events">
      {events.map((event) => {
        const isEventOpen = event.status === 'open';
        const isStartDisabled = isStarting || !isEventOpen;
        const buttonText = getEventStartButtonText(event.status, isStarting);

        return (
          <View
            key={event.id}
            accessibilityLabel={`Quiz event ${event.title}, prize ${event.prizeName}`}
            style={styles.eventCard}
          >
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.eventPrize}>{event.prizeName}</Text>
            <Text style={styles.eventMeta}>
              {event.questionCount} questions,{' '}
              {formatTimeRange(event, locale, timeNotSetLabel)}, free entry
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${buttonText} ${event.title}`}
              accessibilityState={{ disabled: isStartDisabled }}
              disabled={isStartDisabled}
              onPress={() => {
                if (!isStartDisabled) {
                  onStart(event.id);
                }
              }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>{buttonText}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
