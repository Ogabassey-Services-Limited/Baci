import 'server-only';

import { getAgenticPaystackDvaMode } from './agentic-paystack-dva-mode';

export function isAgenticPaystackDvaPaused(): boolean {
  return getAgenticPaystackDvaMode() === 'paused';
}
