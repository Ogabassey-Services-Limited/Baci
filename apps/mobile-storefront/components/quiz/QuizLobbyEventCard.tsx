import { QUIZ_DEFAULT_TIME_PER_QUESTION_SECONDS } from '@baci/shared/constants';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import coinsImage from '@/assets/quiz/png/Coins.png';
import { useTheme } from '@/hooks/useTheme';
import type { QuizEvent } from '@/services/quiz-types';
import type { createQuizLobbyStyles } from './QuizLobby.styles';
import {
  formatQuizClock,
  formatRemainingTime,
  getEventStartButtonText,
  getPrizeMomentLabel,
} from './QuizScreen.utils';
import { useQuizEventTimer } from './use-quiz-event-timer';
import { calculateQuizServerClockOffset } from './use-quiz-server-clock';

type QuizStyles = ReturnType<typeof createQuizLobbyStyles>;

interface QuizLobbyEventCardProps {
  event: QuizEvent;
  isResume: boolean;
  isStarting: boolean;
  locale?: string;
  onOpenRules: (requiresAcceptance: boolean) => void;
  onResume: () => void;
  serverNow?: string;
  styles: QuizStyles;
}

export function QuizLobbyEventCard({
  event,
  isResume,
  isStarting,
  locale,
  onOpenRules,
  onResume,
  serverNow,
  styles,
}: QuizLobbyEventCardProps) {
  const { colors } = useTheme();
  const [imageFailed, setImageFailed] = useState(false);
  const isPlayable = event.status === 'open' || event.status === 'active';
  const isClosed = ['closed', 'completed', 'cancelled', 'finalizing'].includes(
    event.status
  );
  const { remainingSeconds } = useQuizEventTimer({
    eventEndsAt: event.endsAt,
    isActive: event.status === 'active',
    onExpire: () => undefined,
    serverClockOffsetMs: serverNow
      ? calculateQuizServerClockOffset(serverNow)
      : 0,
  });
  const buttonText = getEventStartButtonText(
    event.status,
    isStarting,
    isResume
  );
  const condition = event.prizeProduct?.condition?.replace('_', ' ');

  return (
    <View
      accessibilityLabel={`Quiz event ${event.title}, prize ${event.prizeName}`}
      style={[styles.eventCard, isClosed ? styles.eventCardClosed : undefined]}
    >
      <View style={styles.eventTopline}>
        <Text style={styles.prizeMoment}>
          {getPrizeMomentLabel(event, serverNow)}
        </Text>
        <View
          style={event.mode === 'test' ? styles.testBadge : styles.liveBadge}
        >
          <Text style={styles.badgeText}>
            {event.mode === 'test'
              ? 'TEST'
              : event.status === 'active'
                ? 'LIVE'
                : 'QUIZ'}
          </Text>
        </View>
      </View>

      <View style={styles.prizeStage}>
        <View style={styles.prizeCopy}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.eventPrize}>Win {event.prizeName}</Text>
          {condition ? (
            <Text style={styles.prizeCondition}>{condition}</Text>
          ) : null}
        </View>
        <View style={styles.prizeImageFrame}>
          <Image
            accessibilityLabel={`${event.prizeName} prize image`}
            cachePolicy="memory-disk"
            contentFit="contain"
            onError={() => setImageFailed(true)}
            source={
              !imageFailed && event.prizeProduct?.imageUrl
                ? { uri: event.prizeProduct.imageUrl }
                : coinsImage
            }
            style={styles.prizeImage}
          />
        </View>
      </View>

      {event.status === 'active' && event.endsAt ? (
        <View style={styles.countdownRow}>
          <View style={styles.livePulse} />
          <Text accessibilityRole="timer" style={styles.countdownValue}>
            {formatRemainingTime(remainingSeconds)}
          </Text>
          <Text style={styles.countdownLabel}>until entries close</Text>
        </View>
      ) : null}

      <View style={styles.timingStrip}>
        <Text style={styles.timingFact}>{event.questionCount} questions</Text>
        <Text style={styles.timingDot}>•</Text>
        <Text style={styles.timingFact}>
          {event.timePerQuestionSeconds ??
            QUIZ_DEFAULT_TIME_PER_QUESTION_SECONDS}
          s each
        </Text>
        <Text style={styles.timingDot}>•</Text>
        <Text style={styles.timingFact}>
          Closes {formatQuizClock(event.endsAt, locale, event.timeZone)}
        </Text>
      </View>

      <View
        style={isClosed ? styles.disabledButtonBox : styles.primaryButtonBox}
      >
        <Pressable
          accessibilityLabel={`${buttonText} ${event.title}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: isStarting || !isPlayable }}
          disabled={isStarting || !isPlayable}
          onPress={isResume ? onResume : () => onOpenRules(true)}
          style={styles.primaryButton}
        >
          <Text
            style={
              isClosed ? styles.disabledButtonText : styles.primaryButtonText
            }
          >
            {buttonText}
          </Text>
        </Pressable>
      </View>
      {isPlayable ? (
        <Text style={styles.everySecond}>Every second counts.</Text>
      ) : null}
      <Pressable
        accessibilityLabel={`View rules for ${event.title}`}
        accessibilityRole="button"
        onPress={() => onOpenRules(false)}
        style={styles.rulesLink}
      >
        <Ionicons
          name="information-circle-outline"
          size={17}
          color={colors.textSecondary}
        />
        <Text style={styles.rulesLinkText}>View rules</Text>
      </Pressable>
    </View>
  );
}
