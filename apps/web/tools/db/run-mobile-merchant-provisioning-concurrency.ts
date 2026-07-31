import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createSupabaseReplayDatabaseEnvironment } from './supabase-replay-contract';

type RunOptions = {
  databaseUrl?: string;
  psqlBin?: string;
  spawnProcess?: typeof spawn;
};

type Session = {
  child: ChildProcessWithoutNullStreams;
  stderr: string[];
  stdout: string[];
};

const FUNCTION_CALL = `
SELECT merchant_id, merchant_slug, created
FROM public.provision_mobile_merchant_v2(
  'Concurrent', 'Owner', NULL, :'business_name',
  'retail', NULL, 'NG', NULL, false, NULL, NULL, 'ios'
);`;

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function startSession(
  command: string,
  environment: NodeJS.ProcessEnv,
  spawnProcess: typeof spawn
): Session {
  const child = spawnProcess(command, ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], {
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

function waitForMarker(session: Session, marker: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onData = () => {
      if (!session.stdout.join('').includes(marker)) return;
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
    const cleanup = () => {
      session.child.stdout.off('data', onData);
      session.child.off('close', onClose);
      session.child.off('error', onError);
    };
    session.child.stdout.on('data', onData);
    session.child.on('close', onClose);
    session.child.on('error', onError);
    onData();
  });
}

function waitForExit(session: Session): Promise<string> {
  return new Promise((resolve, reject) => {
    session.child.once('error', () => reject(new Error('psql spawn failed')));
    session.child.once('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `psql exited non-zero: ${session.stderr.join('').trim() || 'unknown'}`
          )
        );
        return;
      }
      resolve(session.stdout.join(''));
    });
  });
}

async function runSql(
  command: string,
  environment: NodeJS.ProcessEnv,
  sql: string,
  spawnProcess: typeof spawn
): Promise<string> {
  const session = startSession(command, environment, spawnProcess);
  const exited = waitForExit(session);
  session.child.stdin.end(sql);
  return await exited;
}

function authenticatedSessionSql(options: {
  businessName: string;
  email: string;
  marker: string;
  userId: string;
}): string {
  const claims = JSON.stringify({
    email: options.email,
    role: 'authenticated',
    sub: options.userId,
  });
  return `
BEGIN;
SELECT set_config('request.jwt.claim.sub', ${sqlLiteral(options.userId)}, true);
SELECT set_config('request.jwt.claims', ${sqlLiteral(claims)}, true);
SET LOCAL ROLE authenticated;
\\set business_name ${sqlLiteral(options.businessName)}
${options.marker === 'B_STARTED' ? '\\echo B_STARTED' : ''}
${FUNCTION_CALL}
${options.marker === 'A_PROVISIONED' ? '\\echo A_PROVISIONED' : ''}
`;
}

export async function runMobileMerchantProvisioningConcurrency(
  options: RunOptions = {}
): Promise<void> {
  const databaseUrl = options.databaseUrl ?? process.env.LOCAL_DATABASE_URL;
  if (!databaseUrl) throw new Error('LOCAL_DATABASE_URL is required');
  const environment = createSupabaseReplayDatabaseEnvironment(databaseUrl);
  const psqlBin = options.psqlBin ?? '/opt/homebrew/opt/libpq/bin/psql';
  const spawnProcess = options.spawnProcess ?? spawn;
  const userId = randomUUID();
  const email = `mobile-concurrency-${userId}@example.test`;
  const businessName = `Mobile Concurrency ${userId}`;
  let sessionA: Session | undefined;
  let sessionB: Session | undefined;

  try {
    await runSql(
      psqlBin,
      environment,
      `INSERT INTO auth.users (id, email) VALUES (${sqlLiteral(userId)}, ${sqlLiteral(email)});\n`,
      spawnProcess
    );

    sessionA = startSession(psqlBin, environment, spawnProcess);
    sessionA.child.stdin.write(
      authenticatedSessionSql({
        businessName,
        email,
        marker: 'A_PROVISIONED',
        userId,
      })
    );
    await waitForMarker(sessionA, 'A_PROVISIONED');

    sessionB = startSession(psqlBin, environment, spawnProcess);
    const sessionBExit = waitForExit(sessionB);
    sessionB.child.stdin.end(
      `${authenticatedSessionSql({
        businessName,
        email,
        marker: 'B_STARTED',
        userId,
      })}COMMIT;\n`
    );
    await waitForMarker(sessionB, 'B_STARTED');

    const sessionAExit = waitForExit(sessionA);
    sessionA.child.stdin.end('COMMIT;\n');
    const [outputA, outputB] = await Promise.all([sessionAExit, sessionBExit]);
    const createdTrueCount = [outputA, outputB].filter((output) =>
      output.includes('|t')
    ).length;

    const counts = await runSql(
      psqlBin,
      environment,
      `
SELECT
  (SELECT count(*) FROM public.merchants WHERE user_id = ${sqlLiteral(userId)}) AS merchant_count,
  (SELECT count(*) FROM public.domains d JOIN public.merchants m ON m.id = d.merchant_id
    WHERE m.user_id = ${sqlLiteral(userId)} AND d.status = 'active') AS domain_count,
  (SELECT count(*) FROM public.staff_members s JOIN public.merchants m ON m.id = s.merchant_id
    WHERE m.user_id = ${sqlLiteral(userId)} AND s.user_id = ${sqlLiteral(userId)}
      AND s.status = 'active') AS staff_count;
`,
      spawnProcess
    );
    if (counts.trim() !== '1|1|1' || createdTrueCount !== 1) {
      throw new Error(
        `concurrency cardinality mismatch: ${counts.trim()} created_true_count=${createdTrueCount}`
      );
    }
  } finally {
    sessionA?.child.kill('SIGTERM');
    sessionB?.child.kill('SIGTERM');
    await runSql(
      psqlBin,
      environment,
      `
BEGIN;
SELECT pg_catalog.set_config(
  'app.audit_actor_user_id',
  ${sqlLiteral(userId)},
  true
);
DELETE FROM public.domains USING public.merchants
WHERE domains.merchant_id = merchants.id AND merchants.user_id = ${sqlLiteral(userId)};
DELETE FROM public.staff_members USING public.merchants
WHERE staff_members.merchant_id = merchants.id AND merchants.user_id = ${sqlLiteral(userId)};
DELETE FROM public.merchants WHERE user_id = ${sqlLiteral(userId)};
DELETE FROM auth.users WHERE id = ${sqlLiteral(userId)};
COMMIT;
`,
      spawnProcess
    ).catch(() => undefined);
  }
}

if (import.meta.url === new URL(process.argv[1] ?? '', 'file:').href) {
  runMobileMerchantProvisioningConcurrency().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Concurrency check failed'}\n`
    );
    process.exitCode = 1;
  });
}
