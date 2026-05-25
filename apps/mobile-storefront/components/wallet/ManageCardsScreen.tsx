import Ionicons from '@react-native-vector-icons/ionicons';
import { router } from 'expo-router';
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { listSavedVtuCards, type SavedVtuCard } from '@/lib/vtu-checkout';
import { formatCardMeta } from './card-formatting.helpers';
import { createManageCardsStyles } from './ManageCardsScreen.styles';

type LoadCardsInput = {
  refresh?: boolean;
  setCards: Dispatch<SetStateAction<SavedVtuCard[]>>;
  setErrorMessage: Dispatch<SetStateAction<string | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setIsRefreshing: Dispatch<SetStateAction<boolean>>;
  signal: AbortSignal;
};

async function loadCards({
  refresh = false,
  setCards,
  setErrorMessage,
  setIsLoading,
  setIsRefreshing,
  signal,
}: LoadCardsInput) {
  if (refresh) {
    setIsRefreshing(true);
  } else {
    setIsRefreshing(false);
    setIsLoading(true);
  }

  try {
    const response = await listSavedVtuCards({ signal });
    if (signal.aborted) {
      return;
    }
    setCards(response);
    setErrorMessage(null);
  } catch (error) {
    if (signal.aborted) {
      return;
    }
    setErrorMessage(
      error instanceof Error
        ? error.message
        : 'Unable to load saved cards right now.'
    );
  } finally {
    if (!signal.aborted) {
      if (refresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }
}

type RunCardsLoadInput = Omit<LoadCardsInput, 'signal'> & {
  activeLoadControllerRef: { current: AbortController | null };
};

function runCardsLoad({
  activeLoadControllerRef,
  refresh,
  setCards,
  setErrorMessage,
  setIsLoading,
  setIsRefreshing,
}: RunCardsLoadInput) {
  activeLoadControllerRef.current?.abort();
  const controller = new AbortController();
  activeLoadControllerRef.current = controller;

  void loadCards({
    refresh,
    setCards,
    setErrorMessage,
    setIsLoading,
    setIsRefreshing,
    signal: controller.signal,
  }).finally(() => {
    if (activeLoadControllerRef.current === controller) {
      activeLoadControllerRef.current = null;
    }
  });
}

export function ManageCardsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const styles = createManageCardsStyles(colors);
  const [cards, setCards] = useState<SavedVtuCard[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const activeLoadControllerRef = useRef<AbortController | null>(null);

  const startCardsLoad = (refresh = false) => {
    runCardsLoad({
      activeLoadControllerRef,
      refresh,
      setCards,
      setErrorMessage,
      setIsLoading,
      setIsRefreshing,
    });
  };

  useEffect(() => {
    runCardsLoad({
      activeLoadControllerRef,
      setCards,
      setErrorMessage,
      setIsLoading,
      setIsRefreshing,
    });
    return () => {
      activeLoadControllerRef.current?.abort();
      activeLoadControllerRef.current = null;
    };
  }, []);

  return (
    // app/wallet/manage-cards.tsx supplies StorefrontScreenShell. Keep the
    // inner ScrollView here because the shared shell has no refresh/footer API.
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        testID="manage-cards-scroll-view"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => startCardsLoad(true)}
            tintColor={BRAND.primary}
          />
        }
      >
        <Text style={[styles.title, { color: colors.text }]}>Manage Cards</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Cards saved after successful Paystack payments appear here for faster
          checkout and savings auto-debit setup.
        </Text>

        {isLoading ? (
          <View style={styles.centeredState}>
            <ActivityIndicator
              size="large"
              color={BRAND.primary}
              accessibilityLabel="Loading saved cards"
            />
          </View>
        ) : null}

        {!isLoading && errorMessage ? (
          <View
            style={[
              styles.stateCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons name="warning-outline" size={20} color={BRAND.primary} />
            <Text style={[styles.stateText, { color: colors.text }]}>
              {errorMessage}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading cards"
              style={styles.retryButton}
              onPress={() => startCardsLoad()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {!isLoading && !errorMessage && cards.length === 0 ? (
          <View
            style={[
              styles.stateCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons name="card-outline" size={20} color={BRAND.primary} />
            <Text style={[styles.stateText, { color: colors.text }]}>
              You have no saved cards yet.
            </Text>
          </View>
        ) : null}

        {!isLoading && !errorMessage && cards.length > 0 ? (
          <View style={styles.cardsList}>
            {cards.map((card) => (
              <View
                key={card.id}
                style={[
                  styles.cardRow,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.cardRowLeft}>
                  <Text style={[styles.cardLabel, { color: colors.text }]}>
                    {card.label}
                  </Text>
                  <Text
                    style={[styles.cardMeta, { color: colors.textSecondary }]}
                  >
                    {formatCardMeta(card)}
                  </Text>
                  {card.bank ? (
                    <Text
                      style={[
                        styles.cardMeta,
                        styles.cardBankMeta,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {card.bank}
                    </Text>
                  ) : null}
                </View>
                {card.is_default ? (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>Default</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.bottomActionWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fund wallet"
          style={styles.primaryButton}
          onPress={() =>
            router.push({
              pathname: '/wallet',
              params: { action: 'fund' },
            })
          }
        >
          <Text style={styles.primaryButtonText}>Fund Wallet</Text>
        </Pressable>
      </View>
    </View>
  );
}
