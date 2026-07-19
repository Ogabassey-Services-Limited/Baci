import 'server-only';

export type AgenticPaystackDvaMode = 'enabled' | 'paused';

export function getAgenticPaystackDvaMode(): AgenticPaystackDvaMode {
  const mode = process.env.AGENTIC_PAYSTACK_DVA_MODE;

  if (mode === 'enabled' || mode === 'paused') {
    return mode;
  }

  if (mode === undefined && process.env.NODE_ENV !== 'production') {
    return 'enabled';
  }

  throw new Error(
    'AGENTIC_PAYSTACK_DVA_MODE must be exactly "enabled" or "paused"'
  );
}
