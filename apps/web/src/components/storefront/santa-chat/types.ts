/**
 * Santa Chat Type Definitions
 */

// The Santa action directive parser is shared with the mobile storefront so
// both parse `ACTION:ADD_TO_CART|...` identically.
export {
  parseSantaAction,
  type SantaAction,
  stripSantaActions,
} from '@baci/shared/lib';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  audioUrl?: string;
  action?: string;
}
