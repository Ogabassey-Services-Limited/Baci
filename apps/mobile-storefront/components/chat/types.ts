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

export const SUGGESTIONS = [
  { label: 'Track my order', icon: 'location-outline' as const },
  { label: 'Best gaming phones', icon: 'flash-outline' as const },
  { label: "I've sent my payment", icon: 'card-outline' as const },
  { label: 'Contact support', icon: 'headset-outline' as const },
];

export const PROACTIVE_MESSAGES = [
  'Looking for a new phone?',
  'Need help checking an IMEI?',
  'Want to see gaming laptops?',
  'I can help you swap your device!',
  'Searching for a specific spec?',
  'Check out our daily deals!',
  'Need a repair quote?',
];
