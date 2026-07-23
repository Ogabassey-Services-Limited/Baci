export type AgenticPaystackDvaMode = 'enabled' | 'paused';

export function resolveAgenticPaystackDvaMode(
  env: Partial<
    Pick<NodeJS.ProcessEnv, 'AGENTIC_PAYSTACK_DVA_MODE' | 'NODE_ENV'>
  > = process.env
): AgenticPaystackDvaMode {
  const mode = env.AGENTIC_PAYSTACK_DVA_MODE;

  if (mode === 'enabled' || mode === 'paused') {
    return mode;
  }

  if (mode === undefined && env.NODE_ENV !== 'production') {
    return 'enabled';
  }

  throw new Error(
    'AGENTIC_PAYSTACK_DVA_MODE must be exactly "enabled" or "paused"'
  );
}
