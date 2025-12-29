import {
  CopilotRuntime,
  copilotRuntimeNextJSAppRouterEndpoint,
  GoogleGenerativeAIAdapter,
} from '@copilotkit/runtime';
import type { NextRequest } from 'next/server';

const serviceAdapter = new GoogleGenerativeAIAdapter({
  model: 'gemini-3-flash-preview',
});

const runtime = new CopilotRuntime();

export const POST = (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: '/api/copilotkit',
  });

  return handleRequest(req);
};
