import 'server-only';

import {
  type AgenticPaystackDvaMode,
  resolveAgenticPaystackDvaMode,
} from './agentic-paystack-dva-mode-value';

export type { AgenticPaystackDvaMode };

export function getAgenticPaystackDvaMode(): AgenticPaystackDvaMode {
  return resolveAgenticPaystackDvaMode();
}
