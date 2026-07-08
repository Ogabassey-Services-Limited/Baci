import type Ionicons from '@react-native-vector-icons/ionicons';
import type { Href } from 'expo-router';
import type { ComponentProps } from 'react';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface ChatWidgetProps {
  /** Enable Santa theme mode */
  santaMode?: boolean;
  /** Bottom offset for positioning above tab bar */
  bottomOffset?: number;
}

export interface ChatSuggestion {
  label: string;
  icon: IoniconsName;
  /**
   * When set, pressing the chip navigates to this route (deep-link) instead of
   * sending the label as a chat message.
   */
  route?: Href;
}

export const SUGGESTIONS: ChatSuggestion[] = [
  { label: 'Track my order', icon: 'location-outline' },
  { label: 'Best gaming phones', icon: 'flash-outline' },
  { label: "I've sent my payment", icon: 'card-outline' },
  { label: 'Repair quote', icon: 'construct-outline', route: '/repairs' },
  { label: 'Contact support', icon: 'headset-outline' },
];

/**
 * Resolves a suggestion chip's navigation target. Returns null for
 * message-sending chips. Pure so the deep-link contract is unit-testable.
 */
export function resolveSuggestionRoute(
  suggestion: Pick<ChatSuggestion, 'route'>
): Href | null {
  return suggestion.route ?? null;
}

export const PROACTIVE_MESSAGES = [
  'Looking for a new phone?',
  'Need help checking an IMEI?',
  'Want to see gaming laptops?',
  'I can help you swap your device!',
  'Searching for a specific spec?',
  'Check out our daily deals!',
  'Need a repair quote?',
];
