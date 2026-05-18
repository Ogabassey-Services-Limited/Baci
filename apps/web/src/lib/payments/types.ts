export type GatewayVerificationResult =
  | {
      success: true;
      status: string;
      gatewayResponse: Record<string, unknown>;
    }
  | {
      success: false;
      error: string;
      code?: string;
    };
