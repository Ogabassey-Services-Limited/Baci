export type TopologyFamily =
  | 'worker-custom-domain'
  | 'r2-cors'
  | 'r2-custom-domain';
type TopologyTuple = Readonly<{ state: string; fingerprint: string }>;
type TopologyReadback = Readonly<{
  tuple: TopologyTuple;
  pendingOperation: boolean;
  elapsedSeconds: number;
}>;
type TopologyPlan = Readonly<{
  family: TopologyFamily;
  action: 'detach' | 'write';
  endpoint: string;
  requestSchemaSha256: string;
  maximumVisibilitySeconds: number;
  before: TopologyTuple;
  intermediate: TopologyTuple;
  after: TopologyTuple;
}>;
type TraceExpectation = Readonly<{
  cacheRuleId: string;
  rulesetVersion: string;
  expressionSha256: string;
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
  topologyMutate(
    family: TopologyFamily,
    endpoint: string,
    requestSchemaSha256: string
  ): Promise<Readonly<{ operationId?: string; lostResponse?: boolean }>>;
  topologyPoll(
    family: TopologyFamily,
    maximumVisibilitySeconds: number
  ): Promise<readonly TopologyReadback[]>;
  topologyControlReadback(
    family: TopologyFamily,
    maximumVisibilitySeconds: number
  ): Promise<readonly TopologyReadback[]>;
}>;
const sameTuple = (left: TopologyTuple, right: TopologyTuple) =>
  left.state === right.state && left.fingerprint === right.fingerprint;

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
  }>
) {
  if (!Number.isInteger(input.pointerProbeCount) || input.pointerProbeCount < 2)
    throw new Error('pointer probes must be repeated independently');
  const trace = await client.trace(input.pointerUrl);
  if (
    !trace.matched ||
    trace.cacheRuleId !== input.trace.cacheRuleId ||
    trace.rulesetVersion !== input.trace.rulesetVersion ||
    trace.expressionSha256 !== input.trace.expressionSha256
  )
    throw new Error('Trace did not bind the exact cache rule and expression');
  for (const method of ['GET', 'HEAD'] as const)
    for (let index = 0; index < input.pointerProbeCount; index++) {
      const response = await client.pointerProbe(method, input.pointerUrl);
      if (
        !['DYNAMIC', 'BYPASS'].includes(response.cfCacheStatus) ||
        response.age
      )
        throw new Error('pointer cache probe observed a cacheable response');
    }
  const families = new Set(input.topologies.map((topology) => topology.family));
  if (families.size !== 3)
    throw new Error('each topology family requires an independent contract');
  for (const topology of input.topologies) {
    if (sameTuple(topology.before, topology.after))
      throw new Error('topology qualification requires a real mutation');
    if (!sameTuple(await client.topologyRead(topology.family), topology.before))
      throw new Error('topology before tuple does not match');
    await client.topologyMutate(
      topology.family,
      topology.endpoint,
      topology.requestSchemaSha256
    );
    verifyMutationConvergence(
      await client.topologyPoll(
        topology.family,
        topology.maximumVisibilitySeconds
      ),
      topology
    );
    verifyControlNoEffect(
      await client.topologyControlReadback(
        topology.family,
        topology.maximumVisibilitySeconds
      ),
      topology
    );
  }
  return { qualified: true as const };
}
