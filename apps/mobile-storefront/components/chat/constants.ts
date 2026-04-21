import { Dimensions } from 'react-native';
import {
  CHAT_WIDGET_DEFAULT_BOTTOM_OFFSET,
  CHAT_WIDGET_FAB_SIZE,
} from '@/constants/layout';
import { resolveApiBaseUrl } from '@/lib/api-url';

/**
 * Screens where the chat widget should be hidden:
 * - Checkout flows (form interference, payment focus)
 * - Auth screens (user not yet engaged)
 * - Order success (celebration screen, CTAs prominent)
 * - Modal screens (overlay stacking issues)
 */
export const HIDDEN_ROUTES = [
  '/checkout',
  '/bnpl-checkout',
  '/order-success',
  '/auth/login',
  '/cart',
  '/modal',
  '/orders',
  '/search',
  '/account',
];

// H24 note: These are intentionally static — used only for FAB initial position
// and PanResponder snap targets set once in useRef. Dynamic checks (e.g. nudge
// positioning) call Dimensions.get('window') at runtime for accuracy.
// useWindowDimensions() cannot be used at module level (hooks require components).
export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
  Dimensions.get('window');

// API base URL - uses the web app's API
export const API_BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);

// FAB dimensions and margins
export const FAB_SIZE = CHAT_WIDGET_FAB_SIZE;
export const EDGE_MARGIN = 16;
export const SNAP_THRESHOLD = SCREEN_WIDTH / 2;
export { CHAT_WIDGET_DEFAULT_BOTTOM_OFFSET };

// Intermittent nudge constants
export const NUDGE_VISIBLE_DURATION = 10000; // 10 seconds
export const NUDGE_HIDDEN_DURATION = 30000; // 30 seconds
export const NUDGE_INITIAL_DELAY = 5000; // 5 seconds
