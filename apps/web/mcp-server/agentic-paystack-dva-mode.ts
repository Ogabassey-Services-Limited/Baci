import { resolveAgenticPaystackDvaMode } from '../src/lib/agentic/agentic-paystack-dva-mode-value';

export function isMcpAgenticPaystackDvaEnabled(
  env: Partial<
    Pick<
      NodeJS.ProcessEnv,
      'AGENTIC_PAYSTACK_DVA_MODE' | 'NODE_ENV'
    >
  > = process.env
): boolean {
  return resolveAgenticPaystackDvaMode(env) === 'enabled';
}
