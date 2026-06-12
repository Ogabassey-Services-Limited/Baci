export type JsonObject = Record<string, unknown>;

export type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: JsonObject;
  annotations: {
    readOnlyHint: true;
    untrustedContentHint: true;
  };
  execute: (input: unknown) => Promise<unknown>;
};

export type WebMcpModelContext = {
  registerTool: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal }
  ) => unknown;
};

export type CatchableRegistration = {
  catch: (onRejected: (error: unknown) => void) => unknown;
};
