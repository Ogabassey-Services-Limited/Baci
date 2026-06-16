import {
  Headphones,
  ShoppingBag,
  Truck,
  Zap,
} from 'lucide-react';
import { createElement } from 'react';

export interface SantaCartAction {
  productName: string;
  price: number;
  added: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  /**
   * @deprecated Use `santaActions` for new code. Kept only so older
   * Ogabassey chat message render paths can read previously shaped messages
   * during the multi-action migration.
   */
  santaAction?: SantaCartAction;
  /** All Santa cart actions parsed from one assistant response. */
  santaActions?: SantaCartAction[];
}

export const SUGGESTIONS = [
  {
    label: 'Track my order',
    icon: createElement(Truck, { size: 14, className: 'text-red-600' }),
  },
  {
    label: 'Best gaming phones',
    icon: createElement(Zap, { size: 14, className: 'text-red-600' }),
  },
  {
    label: "I've sent my payment",
    icon: createElement(ShoppingBag, { size: 14, className: 'text-red-600' }),
  },
  {
    label: 'Contact support',
    icon: createElement(Headphones, { size: 14, className: 'text-red-600' }),
  },
];

export const PROACTIVE_MESSAGES = [
  "Looking for a new phone? \u{1F4F1}",
  "Need help checking an IMEI? \u{1F50D}",
  "Want to see gaming laptops? \u{1F3AE}",
  "I can help you swap your device! \u{1F504}",
  "Searching for a specific spec? \u26A1",
  "Check out our daily deals! \u{1F3F7}\uFE0F",
  "Need a repair quote? \u{1F527}",
];
