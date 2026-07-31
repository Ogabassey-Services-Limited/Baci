export type TopologyFamily =
  | 'worker-custom-domain'
  | 'r2-cors'
  | 'r2-custom-domain';
type TopologyTuple = Readonly<{ state: string; fingerprint: string }>;
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
  topologyConverged(
    family: TopologyFamily,
    expected: TopologyTuple,
    maximumVisibilitySeconds: number
  ): Promise<boolean>;
  topologyControlNoEffect(
    family: TopologyFamily,
    maximumVisibilitySeconds: number
  ): Promise<boolean>;
}>;
const sameTuple = (left: TopologyTuple, right: TopologyTuple) =>
  left.state === right.state && left.fingerprint === right.fingerprint;

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
    if (!sameTuple(await client.topologyRead(topology.family), topology.before))
      throw new Error('topology before tuple does not match');
    const operation = await client.topologyMutate(
      topology.family,
      topology.endpoint,
      topology.requestSchemaSha256
    );
    if (
      !sameTuple(
        await client.topologyRead(topology.family),
        topology.intermediate
      )
    )
      throw new Error('topology intermediate tuple does not match');
    if (
      operation.lostResponse &&
      !(await client.topologyConverged(
        topology.family,
        topology.after,
        topology.maximumVisibilitySeconds
      ))
    )
      throw new Error('lost-response topology did not converge');
    if (!sameTuple(await client.topologyRead(topology.family), topology.after))
      throw new Error('topology after tuple does not match');
    if (
      !(await client.topologyControlNoEffect(
        topology.family,
        topology.maximumVisibilitySeconds
      ))
    )
      throw new Error('topology control no-effect bound was not proven');
  }
  return { qualified: true as const };
}
