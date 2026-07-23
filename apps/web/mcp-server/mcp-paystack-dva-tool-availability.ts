import { isMcpAgenticPaystackDvaEnabled } from './agentic-paystack-dva-mode';

export function resolveMcpPaystackDvaToolAvailability(
  env: NodeJS.ProcessEnv = process.env,
  reportError: (message: string) => void = (message) => console.error(message)
): boolean {
  try {
    return isMcpAgenticPaystackDvaEnabled(env);
  } catch (error) {
    reportError(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Invalid Agentic Paystack DVA mode',
        event: 'agentic_paystack_dva_tool_disabled',
      })
    );
    return false;
  }
}
