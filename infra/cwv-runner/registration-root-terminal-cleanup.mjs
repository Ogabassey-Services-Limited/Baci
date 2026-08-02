const SYSTEMCTL = '/bin/systemctl';
const fail = () => {
  throw new TypeError('registration cleanup refused');
};

export async function readSystemdUnitProperties(execute, unit, properties) {
  const expected = new Set(properties);
  if (
    typeof execute !== 'function' ||
    typeof unit !== 'string' ||
    expected.size !== properties.length
  )
    fail();
  const output = await execute(SYSTEMCTL, [
    'show',
    unit,
    ...properties.map((property) => `--property=${property}`),
    '--no-pager',
  ]);
  if (typeof output !== 'string' || !output.endsWith('\n')) fail();
  const values = {};
  for (const line of output.slice(0, -1).split('\n')) {
    const separator = line.indexOf('=');
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1);
    if (
      separator < 1 ||
      !expected.has(key) ||
      key in values ||
      value.length === 0
    )
      fail();
    values[key] = value;
  }
  if (Object.keys(values).length !== expected.size) fail();
  return Object.freeze(values);
}

export async function stopRegistrationDaemons(execute) {
  await execute(SYSTEMCTL, [
    'stop',
    'baci-cwv-docker.service',
    'baci-cwv-containerd.service',
  ]);
  const state = async (unit) => {
    const value = await readSystemdUnitProperties(execute, unit, [
      'ActiveState',
      'LoadState',
    ]);
    if (value.ActiveState === 'inactive' && value.LoadState === 'loaded')
      return 'stopped';
    if (value.ActiveState === 'inactive' && value.LoadState === 'not-found')
      return 'absent';
    fail();
  };
  return Object.freeze({
    containerd: await state('baci-cwv-containerd.service'),
    docker: await state('baci-cwv-docker.service'),
    schemaVersion: 1,
  });
}

export async function requireAbsent(stat, path) {
  try {
    await stat(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  fail();
}
