import { describe, expect, it, vi } from 'vitest';
import { resolveMcpPaystackDvaToolAvailability } from './mcp-paystack-dva-tool-availability';

describe('resolveMcpPaystackDvaToolAvailability', () => {
  it('returns the strict configured availability without reporting an error', () => {
    const reportError = vi.fn();

    expect(
      resolveMcpPaystackDvaToolAvailability(
        {
          AGENTIC_PAYSTACK_DVA_MODE: 'enabled',
          NODE_ENV: 'production',
        },
        reportError
      )
    ).toBe(true);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('fails closed and reports invalid production configuration', () => {
    const reportError = vi.fn();

    expect(
      resolveMcpPaystackDvaToolAvailability(
        {
          AGENTIC_PAYSTACK_DVA_MODE: 'invalid',
          NODE_ENV: 'production',
        },
        reportError
      )
    ).toBe(false);
    expect(reportError).toHaveBeenCalledWith(
      expect.stringContaining('agentic_paystack_dva_tool_disabled')
    );
  });
});
