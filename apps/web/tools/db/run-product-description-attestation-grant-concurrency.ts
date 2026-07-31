import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createSupabaseReplayDatabaseEnvironment } from './supabase-replay-contract';

type RunOptions = { databaseUrl?: string; psqlBin?: string };
type Session = {
  child: ChildProcessWithoutNullStreams;
  stderr: string[];
  stdout: string[];
};
type SessionResult = { code: number | null; stderr: string; stdout: string };

function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function session(environment: NodeJS.ProcessEnv, psqlBin: string): Session {
  const child = spawn(psqlBin, ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], {
    env: environment,
    shell: false,
    stdio: 'pipe',
  }) as ChildProcessWithoutNullStreams;
  const stdout: string[] = [];
  const stderr: string[] = [];
  child.stdout.on('data', (chunk: Buffer) =>
    stdout.push(chunk.toString('utf8'))
  );
  child.stderr.on('data', (chunk: Buffer) =>
    stderr.push(chunk.toString('utf8'))
  );
  return { child, stderr, stdout };
}

function waitForMarker(value: Session, marker: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      value.child.stdout.off('data', onData);
      value.child.off('close', onClose);
      value.child.off('error', onError);
    };
    const onData = () => {
      if (!value.stdout.join('').includes(marker)) return;
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new Error(`psql closed before ${marker}`));
    };
    const onError = () => {
      cleanup();
      reject(new Error(`psql failed before ${marker}`));
    };
    value.child.stdout.on('data', onData);
    value.child.on('close', onClose);
    value.child.on('error', onError);
    onData();
  });
}

function waitForExit(value: Session): Promise<SessionResult> {
  return new Promise((resolve, reject) => {
    value.child.once('error', () => reject(new Error('psql spawn failed')));
    value.child.once('close', (code) =>
      resolve({
        code,
        stderr: value.stderr.join(''),
        stdout: value.stdout.join(''),
      })
    );
  });
}

async function runSql(
  environment: NodeJS.ProcessEnv,
  psqlBin: string,
  sql: string
): Promise<SessionResult> {
  const value = session(environment, psqlBin);
  const result = waitForExit(value);
  value.child.stdin.end(sql);
  const completed = await result;
  if (completed.code !== 0)
    throw new Error(completed.stderr.trim() || 'psql failed');
  return completed;
}

function rpcSql(options: {
  marker: string;
  operationId: string;
  proposedHash: string;
  userId: string;
}): string {
  const claims = JSON.stringify({ role: 'authenticated', sub: options.userId });
  return `
BEGIN;
SELECT set_config('request.jwt.claims', ${literal(claims)}, true);
SET LOCAL ROLE authenticated;
${options.marker === 'B_STARTED' ? '\\echo B_STARTED' : ''}
SELECT grant_id FROM public.request_product_description_attestation_grant(
  :'merchant_id'::uuid, :'product_id'::uuid, ${literal(options.operationId)}::uuid,
  'C1 concurrency old bytes', 'default', repeat('0', 64),
  ${literal(options.proposedHash)}, false, 'manual_description'
);
${options.marker === 'A_GRANTED' ? '\\echo A_GRANTED' : ''}
`;
}

function grantId(output: string): string | undefined {
  return output
    .split(/\s+/)
    .find((value) =>
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
    );
}

async function runScenario(options: {
  environment: NodeJS.ProcessEnv;
  merchantId: string;
  productId: string;
  psqlBin: string;
  userId: string;
  mismatch: boolean;
}): Promise<void> {
  const operationId = randomUUID();
  const first = session(options.environment, options.psqlBin);
  first.child.stdin.write(
    `\\set merchant_id ${literal(options.merchantId)}\n\\set product_id ${literal(options.productId)}\n${rpcSql({ marker: 'A_GRANTED', operationId, proposedHash: 'a'.repeat(64), userId: options.userId })}`
  );
  await waitForMarker(first, 'A_GRANTED');

  const second = session(options.environment, options.psqlBin);
  second.child.stdin.end(
    `\\set merchant_id ${literal(options.merchantId)}\n\\set product_id ${literal(options.productId)}\n${rpcSql({ marker: 'B_STARTED', operationId, proposedHash: options.mismatch ? 'b'.repeat(64) : 'a'.repeat(64), userId: options.userId })}COMMIT;\n`
  );
  await waitForMarker(second, 'B_STARTED');

  const firstExit = waitForExit(first);
  const secondExit = waitForExit(second);
  first.child.stdin.end('COMMIT;\n');
  const [firstResult, secondResult] = await Promise.all([
    firstExit,
    secondExit,
  ]);
  if (options.mismatch) {
    if (
      secondResult.code === 0 ||
      !secondResult.stderr.includes(
        'product_description_attestation_operation_binding_mismatch'
      ) ||
      secondResult.stderr.includes('23505')
    ) {
      throw new Error(
        `mismatched concurrent replay was not stable: ${secondResult.stderr.trim()}`
      );
    }
    return;
  }
  if (
    firstResult.code !== 0 ||
    secondResult.code !== 0 ||
    grantId(firstResult.stdout) !== grantId(secondResult.stdout)
  ) {
    throw new Error(
      `identical concurrent replay was not idempotent: ${firstResult.stderr}${secondResult.stderr}`
    );
  }
}

export async function runProductDescriptionAttestationGrantConcurrency(
  options: RunOptions = {}
): Promise<void> {
  const databaseUrl = options.databaseUrl ?? process.env.LOCAL_DATABASE_URL;
  if (!databaseUrl) throw new Error('LOCAL_DATABASE_URL is required');
  const environment = createSupabaseReplayDatabaseEnvironment(databaseUrl);
  const psqlBin = options.psqlBin ?? '/opt/homebrew/opt/libpq/bin/psql';
  const userId = randomUUID();
  const merchantId = randomUUID();
  const productId = randomUUID();
  try {
    await runSql(
      environment,
      psqlBin,
      `
BEGIN;
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (${literal(userId)}::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ${literal(`c1-concurrency-${userId}@example.test`)}, 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
SELECT set_config('app.audit_actor_user_id', ${literal(userId)}, true);
INSERT INTO public.merchants (id, user_id, email, business_name, slug)
VALUES (${literal(merchantId)}::uuid, ${literal(userId)}::uuid, ${literal(`c1-concurrency-${userId}@example.test`)}, ${literal(`C1 Concurrency ${userId}`)}, ${literal(`c1-concurrency-${userId}`)});
INSERT INTO public.products (id, merchant_id, name, price, description, status, description_digital_source_type, description_provenance_sha256)
VALUES (${literal(productId)}::uuid, ${literal(merchantId)}::uuid, 'C1 concurrency product', 100, 'C1 concurrency old bytes', 'draft', 'default', repeat('0', 64));
COMMIT;
`
    );
    await runScenario({
      environment,
      merchantId,
      productId,
      psqlBin,
      userId,
      mismatch: false,
    });
    await runScenario({
      environment,
      merchantId,
      productId,
      psqlBin,
      userId,
      mismatch: true,
    });
  } finally {
    await runSql(
      environment,
      psqlBin,
      `
SELECT set_config('app.audit_actor_user_id', ${literal(userId)}, false);
DELETE FROM private.product_description_attestation_grants WHERE merchant_id = ${literal(merchantId)}::uuid;
DELETE FROM public.products WHERE id = ${literal(productId)}::uuid;
DELETE FROM public.merchants WHERE id = ${literal(merchantId)}::uuid;
DELETE FROM auth.users WHERE id = ${literal(userId)}::uuid;
`
    ).catch(() => undefined);
  }
}

if (import.meta.url === new URL(process.argv[1] ?? '', 'file:').href) {
  runProductDescriptionAttestationGrantConcurrency().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Concurrency check failed'}\n`
    );
    process.exitCode = 1;
  });
}
