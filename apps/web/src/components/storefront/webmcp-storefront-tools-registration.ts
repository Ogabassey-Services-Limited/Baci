import { buildStorefrontWebMcpTools } from './webmcp-storefront-tools-builder';
import type {
  CatchableRegistration,
  WebMcpModelContext,
  WebMcpTool,
} from './webmcp-storefront-tools-types';

export { parseCatalogSearchInput } from './webmcp-storefront-tools-parsers';
export type { WebMcpModelContext, WebMcpTool };

interface RegisterWebMcpStorefrontToolsOptions {
  merchantId: string;
  merchantSlug: string;
  modelContext: WebMcpModelContext;
  signal: AbortSignal;
}

function isCatchableRegistration(
  value: unknown
): value is CatchableRegistration {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const catchHandler = (value as { catch?: unknown }).catch;
  return typeof catchHandler === 'function' && catchHandler.length >= 1;
}

function logToolRegistrationError(error: unknown, toolName: string): void {
  console.warn('[WebMCP] Failed to register storefront tool', {
    error,
    tool: toolName,
  });
}

export function registerWebMcpStorefrontTools({
  merchantId,
  merchantSlug,
  modelContext,
  signal,
}: RegisterWebMcpStorefrontToolsOptions): void {
  const tools = buildStorefrontWebMcpTools({
    merchantId,
    merchantSlug,
    signal,
  });
  for (const tool of tools) {
    try {
      const registration = modelContext.registerTool(tool, { signal });
      if (isCatchableRegistration(registration)) {
        void registration.catch((error: unknown) => {
          logToolRegistrationError(error, tool.name);
        });
      }
    } catch (error) {
      logToolRegistrationError(error, tool.name);
    }
  }
}
