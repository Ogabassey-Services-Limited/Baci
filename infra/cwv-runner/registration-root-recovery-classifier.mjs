const fail = () => {
  throw new TypeError('registration root recovery classifier refused');
};

export async function classifyRegistrationRecoveryContainer(
  execute,
  dockerPrefix,
  context,
  configuration
) {
  const rows = await execute('/usr/bin/docker', [
    ...dockerPrefix,
    'ps',
    '-a',
    '--no-trunc',
    '--filter',
    `id=${context.containerId}`,
    '--format',
    '{{.ID}}',
  ]);
  if (rows === '') return { present: false };
  if (rows !== `${context.containerId}\n`) fail();
  const name = `baci-cwv-registration-${configuration.context.registrationNonce}`;
  const identity = await execute('/usr/bin/docker', [
    ...dockerPrefix,
    'inspect',
    '--format',
    '{{.Id}} {{.Name}} {{.Image}}',
    context.containerId,
  ]);
  if (
    identity !==
    `${context.containerId} /${name} ${configuration.context.imageDigest}\n`
  )
    fail();
  return { present: true };
}
