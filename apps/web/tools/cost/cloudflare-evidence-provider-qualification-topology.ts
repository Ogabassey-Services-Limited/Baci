import type {
  DeepQualificationClient,
  TopologyMutationAuditReceipt,
  TopologyPlan,
  TopologyReadback,
  TopologyTuple,
} from './cloudflare-evidence-provider-qualification';

type MutationResponse = Awaited<
  ReturnType<DeepQualificationClient['topologyMutate']>
>;
type MutationReceiptParts = Readonly<{
  operationId: string | null;
  lostResponse: boolean;
  responseSchemaSha256: string;
}>;
const SHA256 = /^[a-f0-9]{64}$/;

const sameTopologyTuple = (left: TopologyTuple, right: TopologyTuple) =>
  left.state === right.state && left.fingerprint === right.fingerprint;

function buildTopologyMutationRequest(
  { family, action: defaultAction, endpoint }: TopologyPlan,
  requestSchemaSha256: string,
  action = defaultAction
) {
  return { family, action, endpoint, requestSchemaSha256 };
}

function verifyMutationResponse(
  mutation: MutationResponse,
  expectedResponseSchemaSha256: string
): MutationReceiptParts {
  const operationId = mutation.operationId;
  const lostResponse = mutation.lostResponse;
  const responseSchemaSha256 = mutation.responseSchemaSha256;
  if (
    typeof lostResponse !== 'boolean' ||
    (operationId !== undefined &&
      (typeof operationId !== 'string' || operationId.trim().length === 0)) ||
    (!lostResponse && operationId === undefined)
  )
    throw new Error('topology mutation response is ambiguous');
  if (
    typeof responseSchemaSha256 !== 'string' ||
    !SHA256.test(responseSchemaSha256) ||
    responseSchemaSha256 !== expectedResponseSchemaSha256
  )
    throw new Error('topology mutation response schema is unverified');
  return {
    operationId: operationId ?? null,
    lostResponse,
    responseSchemaSha256,
  };
}

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
      readback.elapsedSeconds < 0 ||
      readback.elapsedSeconds < previousElapsed ||
      readback.elapsedSeconds > topology.maximumVisibilitySeconds
    )
      throw new Error('topology convergence exceeded the visibility bound');
    previousElapsed = readback.elapsedSeconds;
    if (sameTopologyTuple(readback.tuple, topology.after)) reachedAfter = true;
    else if (
      reachedAfter ||
      !sameTopologyTuple(readback.tuple, topology.intermediate)
    )
      throw new Error('topology polling returned a mixed or unknown tuple');
  }
  const final = readbacks.at(-1);
  if (!final || !sameTopologyTuple(final.tuple, topology.after))
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
        !sameTopologyTuple(readback.tuple, topology.before) ||
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

async function restoreTopology(
  client: DeepQualificationClient,
  topology: TopologyPlan
) {
  const receipt = verifyMutationResponse(
    await client.topologyMutate(
      buildTopologyMutationRequest(
        topology,
        topology.restore.requestSchemaSha256,
        topology.restore.action
      )
    ),
    topology.restore.responseSchemaSha256
  );
  verifyControlNoEffect(
    await client.topologyControlReadback(
      topology.family,
      topology.maximumVisibilitySeconds
    ),
    topology
  );
  return receipt;
}

function asError(value: unknown) {
  return value instanceof Error ? value : new Error(String(value));
}

function throwWithRestorationFailure(
  qualificationError: unknown,
  restorationError: unknown
): never {
  const qualification = asError(qualificationError);
  const restoration = asError(restorationError);
  throw new AggregateError(
    [qualification, restoration],
    `topology qualification failed and restoration failed: ${qualification.message}; ${restoration.message}`
  );
}

/** Runs one topology experiment and reconciles any attempted forward mutation. */
export async function executeTopologyMutationWithRollback(
  client: DeepQualificationClient,
  topology: TopologyPlan
): Promise<TopologyMutationAuditReceipt> {
  if (sameTopologyTuple(topology.before, topology.after))
    throw new Error('topology qualification requires a real mutation');
  if (
    !sameTopologyTuple(
      await client.topologyRead(topology.family),
      topology.before
    )
  )
    throw new Error('topology before tuple does not match');

  let forwardMutationAttempted = false;
  let qualificationFailed = false;
  let restorationFailed = false;
  let qualificationError: unknown;
  let restorationError: unknown;
  let restorationReceipt: MutationReceiptParts | undefined;
  let receipt: TopologyMutationAuditReceipt | undefined;
  try {
    // Set this before the provider call: a rejected response is an ambiguous
    // outcome and may still have changed provider state.
    forwardMutationAttempted = true;
    const mutation = await client.topologyMutate(
      buildTopologyMutationRequest(topology, topology.requestSchemaSha256)
    );
    const { operationId, lostResponse, responseSchemaSha256 } =
      verifyMutationResponse(mutation, topology.responseSchemaSha256);
    verifyMutationConvergence(
      await client.topologyPoll(
        topology.family,
        topology.maximumVisibilitySeconds
      ),
      topology
    );
    receipt = {
      family: topology.family,
      action: topology.action,
      restoreAction: topology.restore.action,
      endpoint: topology.endpoint,
      requestSchemaSha256: topology.requestSchemaSha256,
      responseSchemaSha256,
      restoreRequestSchemaSha256: topology.restore.requestSchemaSha256,
      restoreResponseSchemaSha256:
        restorationReceipt?.responseSchemaSha256 ??
        topology.restore.responseSchemaSha256,
      operationId,
      lostResponse,
      restored: true,
    };
  } catch (error) {
    qualificationFailed = true;
    qualificationError = error;
  } finally {
    if (forwardMutationAttempted) {
      try {
        restorationReceipt = await restoreTopology(client, topology);
      } catch (error) {
        restorationFailed = true;
        restorationError = error;
      }
    }
  }
  if (restorationFailed) {
    if (qualificationFailed)
      throwWithRestorationFailure(qualificationError, restorationError);
    throw restorationError;
  }
  if (qualificationFailed) throw qualificationError;
  if (!receipt) throw new Error('topology mutation receipt was not produced');
  if (restorationReceipt)
    receipt = {
      ...receipt,
      restoreResponseSchemaSha256: restorationReceipt.responseSchemaSha256,
    };
  return receipt;
}
