import {
  QUALIFICATION_POINTER_PROBE_COUNT,
  QUALIFICATION_POINTER_URL,
} from './cloudflare-evidence-qualification-schemas';
import {
  type CloudflareTopologyFamily,
  cloudflareTopologyEndpointParts,
  verifyCloudflareTopologyEndpointFamily,
} from './cloudflare-evidence-topology-contract';
export type TopologyFamily = CloudflareTopologyFamily;
export type TopologyAction = 'detach' | 'write';
export type TopologyTuple = Readonly<{ state: string; fingerprint: string }>;
export type TopologyReadback = Readonly<{
  tuple: TopologyTuple;
  pendingOperation: boolean;
  elapsedSeconds: number;
}>;
export type TopologyRestoreContract = Readonly<{
  requestSchemaSha256: string;
  responseSchemaSha256: string;
}>;
export type TopologyPlan = Readonly<{
  family: TopologyFamily;
  action: TopologyAction;
  endpoint: string;
  requestSchemaSha256: string;
  responseSchemaSha256: string;
  maximumVisibilitySeconds: number;
  before: TopologyTuple;
  intermediate: TopologyTuple;
  after: TopologyTuple;
  restore: TopologyRestoreContract;
}>;
export type JournaledTopologyEndpoint = TopologyPlan;
export type TopologyMutationAuditReceipt = Readonly<{
  family: TopologyFamily;
  action: TopologyAction;
  endpoint: string;
  requestSchemaSha256: string;
  responseSchemaSha256: string;
  operationId: string | null;
  lostResponse: boolean;
}>;
type TraceExpectation = Readonly<{
  cacheRuleId: string;
  rulesetVersion: string;
  expressionSha256: string;
}>;
type MutationResponse = {
  operationId?: string;
  lostResponse?: boolean;
};
export type TopologyMutationRequest = Readonly<{
  family: TopologyFamily;
  action: TopologyAction;
  endpoint: string;
  requestSchemaSha256: string;
}>;
export type DeepQualificationClient = Readonly<{
  trace(
    url: string
  ): Promise<TraceExpectation & Readonly<{ matched: boolean }>>;
  pointerProbe(
    method: 'GET' | 'HEAD',
    url: string
  ): Promise<Readonly<{ cfCacheStatus: string; age?: string }>>;
  topologyRead(family: TopologyFamily): Promise<TopologyTuple>;
  topologyMutate(request: TopologyMutationRequest): Promise<MutationResponse>;
  topologyPoll(
    family: TopologyFamily,
    maximumVisibilitySeconds: number
  ): Promise<readonly TopologyReadback[]>;
  topologyControlReadback(
    family: TopologyFamily,
    maximumVisibilitySeconds: number
  ): Promise<readonly TopologyReadback[]>;
}>;
const SHA256 = /^[a-f0-9]{64}$/;
const TOPOLOGY_ACTION_BY_FAMILY = {
  'worker-custom-domain': 'detach',
  'r2-cors': 'write',
  'r2-custom-domain': 'detach',
} as const satisfies Record<TopologyFamily, TopologyAction>;

function verifyMutationResponse(mutation: MutationResponse) {
  const operationId = mutation.operationId;
  const lostResponse = mutation.lostResponse;
  if (
    typeof lostResponse !== 'boolean' ||
    (operationId !== undefined &&
      (typeof operationId !== 'string' || operationId.trim().length === 0)) ||
    (!lostResponse && operationId === undefined)
  )
    throw new Error('topology mutation response is ambiguous');
  return { operationId: operationId ?? null, lostResponse };
}
function verifyJournaledTopologyEndpoints(
  topologies: readonly [TopologyPlan, TopologyPlan, TopologyPlan],
  journaledTopologies: readonly [
    JournaledTopologyEndpoint,
    JournaledTopologyEndpoint,
    JournaledTopologyEndpoint,
  ]
) {
  const journalByFamily = new Map(
    journaledTopologies.map((topology) => [topology.family, topology])
  );
  if (
    journalByFamily.size !== 3 ||
    new Set(topologies.map((topology) => topology.family)).size !== 3
  )
    throw new Error('each topology family requires an independent contract');
  const journaledAccounts = new Set<string>();
  const journaledBuckets = new Set<string>();
  for (const topology of topologies) {
    const journaled = journalByFamily.get(topology.family);
    const expected = TOPOLOGY_ACTION_BY_FAMILY[topology.family];
    if (topology.action !== expected || journaled?.action !== expected)
      throw new Error(
        'topology action violates fixed family-to-action mapping'
      );
    if (
      !journaled ||
      topology.endpoint !== journaled.endpoint ||
      topology.requestSchemaSha256 !== journaled.requestSchemaSha256 ||
      topology.responseSchemaSha256 !== journaled.responseSchemaSha256 ||
      topology.maximumVisibilitySeconds !==
        journaled.maximumVisibilitySeconds ||
      !sameTuple(topology.before, journaled.before) ||
      !sameTuple(topology.intermediate, journaled.intermediate) ||
      !sameTuple(topology.after, journaled.after) ||
      topology.restore.requestSchemaSha256 !==
        journaled.restore.requestSchemaSha256 ||
      topology.restore.responseSchemaSha256 !==
        journaled.restore.responseSchemaSha256 ||
      !SHA256.test(journaled.requestSchemaSha256) ||
      !SHA256.test(journaled.responseSchemaSha256) ||
      !SHA256.test(journaled.restore.requestSchemaSha256) ||
      !SHA256.test(journaled.restore.responseSchemaSha256) ||
      topology.restore.requestSchemaSha256 === topology.requestSchemaSha256 ||
      !verifyCloudflareTopologyEndpointFamily(
        journaled.endpoint,
        journaled.family
      )
    )
      throw new Error('topology mutation endpoint is not journaled');
    const parts = cloudflareTopologyEndpointParts(journaled.endpoint);
    journaledAccounts.add(parts[1]);
    if (topology.family !== 'worker-custom-domain')
      journaledBuckets.add(parts[4]);
  }
  if (journaledAccounts.size !== 1 || journaledBuckets.size > 1)
    throw new Error(
      'topology endpoints do not share the journaled resource scope'
    );
}
const sameTuple = (left: TopologyTuple, right: TopologyTuple) =>
  left.state === right.state && left.fingerprint === right.fingerprint;
const buildTopologyMutationRequest = (
  { family, action, endpoint }: TopologyPlan,
  requestSchemaSha256: string
) => ({ family, action, endpoint, requestSchemaSha256 });

function verifyMutationConvergence(
  readbacks: readonly TopologyReadback[],
  topology: TopologyPlan
) {
  if (readbacks.length < 2)
    throw new Error('topology polling did not prove bounded convergence');
  let reachedAfter = false;
  let previousElapsed = -1;
  for (const readback of readbacks) {
    if (
      !Number.isFinite(readback.elapsedSeconds) ||
      readback.elapsedSeconds < previousElapsed ||
      readback.elapsedSeconds > topology.maximumVisibilitySeconds
    )
      throw new Error('topology convergence exceeded the visibility bound');
    previousElapsed = readback.elapsedSeconds;
    if (sameTuple(readback.tuple, topology.after)) reachedAfter = true;
    else if (reachedAfter || !sameTuple(readback.tuple, topology.intermediate))
      throw new Error('topology polling returned a mixed or unknown tuple');
  }
  const final = readbacks.at(-1);
  if (!final || !sameTuple(final.tuple, topology.after))
    throw new Error('topology did not converge to the exact after tuple');
  if (final.pendingOperation)
    throw new Error('topology after tuple still has a pending operation');
}
function verifyControlNoEffect(
  readbacks: readonly TopologyReadback[],
  topology: TopologyPlan
) {
  if (readbacks.some((readback) => readback.pendingOperation))
    throw new Error('topology control has a pending provider operation');
  if (
    readbacks.length < 2 ||
    readbacks.some(
      (readback) =>
        !sameTuple(readback.tuple, topology.before) ||
        !Number.isFinite(readback.elapsedSeconds) ||
        readback.elapsedSeconds < 0 ||
        readback.elapsedSeconds > topology.maximumVisibilitySeconds
    ) ||
    readbacks.at(-1)?.elapsedSeconds !== topology.maximumVisibilitySeconds
  )
    throw new Error(
      'topology control did not prove the exact unchanged before tuple through the visibility bound'
    );
}

/** Executes only injected reads/writes against the bounded qualification topology contract. */
export async function executeDeepCloudflareEvidenceQualification(
  client: DeepQualificationClient,
  input: Readonly<{
    pointerUrl: string;
    pointerProbeCount: number;
    trace: TraceExpectation;
    topologies: readonly [TopologyPlan, TopologyPlan, TopologyPlan];
    journaledTopologies: readonly [
      JournaledTopologyEndpoint,
      JournaledTopologyEndpoint,
      JournaledTopologyEndpoint,
    ];
  }>
) {
  if (input.pointerProbeCount !== QUALIFICATION_POINTER_PROBE_COUNT)
    throw new Error('pointer probes must be repeated independently');
  if (input.pointerUrl !== QUALIFICATION_POINTER_URL)
    throw new Error(
      'pointer URL does not bind the evidence qualification host'
    );
  verifyJournaledTopologyEndpoints(input.topologies, input.journaledTopologies);
  const trace = await client.trace(QUALIFICATION_POINTER_URL);
  if (
    !trace.matched ||
    trace.cacheRuleId !== input.trace.cacheRuleId ||
    trace.rulesetVersion !== input.trace.rulesetVersion ||
    trace.expressionSha256 !== input.trace.expressionSha256
  )
    throw new Error('Trace did not bind the exact cache rule and expression');
  for (const method of ['GET', 'HEAD'] as const)
    for (let index = 0; index < input.pointerProbeCount; index++) {
      const response = await client.pointerProbe(
        method,
        QUALIFICATION_POINTER_URL
      );
      if (response.cfCacheStatus !== 'DYNAMIC' || response.age !== undefined)
        throw new Error('pointer cache probe observed a cacheable response');
    }
  const mutationReceipts: TopologyMutationAuditReceipt[] = [];
  for (const topology of input.topologies) {
    if (sameTuple(topology.before, topology.after))
      throw new Error('topology qualification requires a real mutation');
    if (!sameTuple(await client.topologyRead(topology.family), topology.before))
      throw new Error('topology before tuple does not match');
    const mutation = await client.topologyMutate(
      buildTopologyMutationRequest(topology, topology.requestSchemaSha256)
    );
    const { operationId, lostResponse } = verifyMutationResponse(mutation);
    mutationReceipts.push({
      family: topology.family,
      action: topology.action,
      endpoint: topology.endpoint,
      requestSchemaSha256: topology.requestSchemaSha256,
      responseSchemaSha256: topology.responseSchemaSha256,
      operationId: operationId ?? null,
      lostResponse,
    });
    verifyMutationConvergence(
      await client.topologyPoll(
        topology.family,
        topology.maximumVisibilitySeconds
      ),
      topology
    );
    verifyMutationResponse(
      await client.topologyMutate(
        buildTopologyMutationRequest(
          topology,
          topology.restore.requestSchemaSha256
        )
      )
    );
    verifyControlNoEffect(
      await client.topologyControlReadback(
        topology.family,
        topology.maximumVisibilitySeconds
      ),
      topology
    );
  }
  return {
    qualified: true as const,
    mutationReceipts: Object.freeze(mutationReceipts),
  };
}
