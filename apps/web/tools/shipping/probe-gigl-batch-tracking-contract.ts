import type { GiglApiClient } from '../../src/lib/shipping/providers/gigl.auth';
import { GiglApiClient as RuntimeGiglApiClient } from '../../src/lib/shipping/providers/gigl.auth';
import {
  GIGL_TRACKING_RESPONSE_MAX_BYTES,
  type GiglFetchOptions,
} from '../../src/lib/shipping/providers/gigl.constants';

const PROBE_GATE = 'BACI_GIGL_TRACKING_CONTRACT_PROBE';
const PROBE_WAYBILL = 'GIGL_TRACKING_PROBE_WAYBILL';
const BATCH_PATH = '/track/multipleMobileShipment';
const REQUEST_TIMEOUT_MS = 15_000;

export interface RedactedGiglBatchContractShape {
  httpStatus: number;
  normalizedEnvelopeKeys: string[];
  dataKind: 'array' | 'null' | 'object' | 'other';
  shipmentKeys: string[];
  eventKeys: string[];
}

export type GiglBatchProbeClient = Pick<
  GiglApiClient,
  'baseUrl' | 'getApiToken' | 'safeFetchEnvelopeWithAccessToken'
>;

type ProbeEnvironment = Record<string, string | undefined>;
type ProbeOutput = (report: string) => void;
type ProbeClientFactory = () =>
  | GiglBatchProbeClient
  | Promise<GiglBatchProbeClient>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sortedKeys(value: unknown): string[] {
  return isRecord(value) ? Object.keys(value).sort() : [];
}

function dataKind(value: unknown): RedactedGiglBatchContractShape['dataKind'] {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  if (isRecord(value)) return 'object';
  return 'other';
}

function firstRecord(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    return value.find(isRecord);
  }
  return isRecord(value) ? value : undefined;
}

function firstNestedRecordArray(value: Record<string, unknown>): unknown {
  for (const child of Object.values(value)) {
    if (Array.isArray(child) && child.some(isRecord)) return child;
  }
  return undefined;
}

function buildStructuralReport(
  httpStatus: number,
  envelope: Record<string, unknown>
): RedactedGiglBatchContractShape {
  const data = envelope.data;
  const shipment = firstRecord(data);
  const event = shipment
    ? firstRecord(firstNestedRecordArray(shipment))
    : undefined;

  return {
    httpStatus,
    normalizedEnvelopeKeys: sortedKeys(envelope),
    dataKind: dataKind(data),
    shipmentKeys: sortedKeys(shipment),
    eventKeys: sortedKeys(event),
  };
}

function requireProbeInput(environment: ProbeEnvironment): string {
  if (environment[PROBE_GATE] !== '1') {
    throw new Error(`${PROBE_GATE}=1 is required`);
  }

  const waybill = environment[PROBE_WAYBILL]?.trim();
  if (!waybill) {
    throw new Error(
      `${PROBE_WAYBILL} must contain exactly one nonblank waybill`
    );
  }

  return waybill;
}

export async function runGiglBatchTrackingContractProbe(
  environment: ProbeEnvironment,
  client: GiglBatchProbeClient,
  output: ProbeOutput
): Promise<RedactedGiglBatchContractShape> {
  const waybill = requireProbeInput(environment);
  const tokenData = await client.getApiToken();
  const result = await client.safeFetchEnvelopeWithAccessToken(
    `${client.baseUrl}${BATCH_PATH}`,
    tokenData,
    () => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Waybill: [waybill] }),
      timeout: REQUEST_TIMEOUT_MS,
    }),
    { maxResponseBytes: GIGL_TRACKING_RESPONSE_MAX_BYTES }
  );

  const envelope = result.envelope;
  if (
    !result.response.ok ||
    !isRecord(envelope) ||
    envelope.success === false ||
    envelope.status < 200 ||
    envelope.status >= 300
  ) {
    throw new Error(
      'GIGL batch tracking probe returned a non-success response'
    );
  }

  const report = buildStructuralReport(result.response.status, envelope);
  output(JSON.stringify(report, null, 2));
  return report;
}

function createRuntimeClient(): GiglBatchProbeClient {
  const safeFetch = (url: string, options: GiglFetchOptions = {}) => {
    const { timeout: _timeout, ...requestInit } = options;
    return fetch(url, {
      ...requestInit,
      signal: requestInit.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  };

  return new RuntimeGiglApiClient({
    safeFetch,
    log: () => undefined,
  });
}

export async function runGiglBatchTrackingContractProbeCli(
  environment: ProbeEnvironment,
  createClient: ProbeClientFactory,
  stdout: ProbeOutput,
  stderr: ProbeOutput
): Promise<number> {
  try {
    await runGiglBatchTrackingContractProbe(
      environment,
      await createClient(),
      stdout
    );
    return 0;
  } catch {
    stderr('GIGL batch tracking contract probe failed\n');
    return 1;
  }
}

async function main(): Promise<void> {
  process.exitCode = await runGiglBatchTrackingContractProbeCli(
    process.env,
    createRuntimeClient,
    (report) => {
      process.stdout.write(`${report}\n`);
    },
    (message) => process.stderr.write(message)
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
