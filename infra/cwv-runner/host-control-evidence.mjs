const SHA256 = /^[a-f0-9]{64}$/;
const CPU_MAX_PERIOD_MICROSECONDS = 100_000;
const fail = (name) => {
  throw new TypeError(`invalid ${name}`);
};

function exact(value, keys, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(name);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, i) => key !== expected[i])
  )
    fail(name);
}

function requireFields(value, keys, name) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    fail(name);
}

function same(value, expected, name) {
  if (value !== expected) fail(name);
}

function cpuQuotaPercent(cpuQuota) {
  const percent = Number.parseInt(cpuQuota, 10);
  if (
    !Number.isSafeInteger(percent) ||
    percent < 1 ||
    cpuQuota !== `${percent}%`
  )
    fail('CPU quota');
  return percent;
}

function cpuQuotaPerSecUsec(cpuQuota) {
  const percent = cpuQuotaPercent(cpuQuota);
  const milliseconds = percent * 10;
  if (!Number.isSafeInteger(milliseconds)) fail('CPU quota');
  return milliseconds % 1000 === 0
    ? `${milliseconds / 1000}s`
    : `${milliseconds}ms`;
}

function cpuMax(cpuQuota) {
  const quota = (cpuQuotaPercent(cpuQuota) * CPU_MAX_PERIOD_MICROSECONDS) / 100;
  if (!Number.isSafeInteger(quota)) fail('CPU quota');
  return `${quota} ${CPU_MAX_PERIOD_MICROSECONDS}`;
}

function cgroups(policy, contract) {
  const control = contract?.fields?.controlCgroup?.expectation;
  const measurement = contract?.fields?.measurementCgroup?.expectation;
  exact(
    control,
    ['cpus', 'cpuQuota', 'ioWeight', 'memoryMax', 'memorySwapMax', 'tasksMax'],
    'control policy'
  );
  exact(
    measurement,
    [
      'cpuAccounting',
      'cpus',
      'ioAccounting',
      'memoryAccounting',
      'memoryMax',
      'memorySwapMax',
      'tasksMax',
    ],
    'measurement policy'
  );
  const imported = policy?.installationImport;
  const resources = policy?.resources;
  requireFields(
    imported,
    [
      'cpuQuotaPercent',
      'cpuSet',
      'ioWeight',
      'memoryBytes',
      'memorySwapBytes',
      'pidsLimit',
    ],
    'installation policy'
  );
  requireFields(
    resources,
    ['measurementCpuSet', 'memoryBytes', 'memorySwapBytes', 'pidsLimit'],
    'resource policy'
  );
  for (const [actual, expected, name] of [
    [control.cpus, imported.cpuSet, 'control CPU policy'],
    [
      control.cpuQuota,
      `${imported.cpuQuotaPercent}%`,
      'control CPU quota policy',
    ],
    [control.ioWeight, imported.ioWeight, 'control IO policy'],
    [control.memoryMax, imported.memoryBytes, 'control memory policy'],
    [control.memorySwapMax, imported.memorySwapBytes, 'control swap policy'],
    [control.tasksMax, imported.pidsLimit, 'control pids policy'],
    [measurement.cpus, resources.measurementCpuSet, 'measurement CPU policy'],
    [measurement.memoryMax, resources.memoryBytes, 'measurement memory policy'],
    [
      measurement.memorySwapMax,
      resources.memorySwapBytes,
      'measurement swap policy',
    ],
    [measurement.tasksMax, resources.pidsLimit, 'measurement pids policy'],
  ])
    same(actual, expected, name);
  return { control, measurement };
}

function validateCgroup(value, expected, kind, control) {
  const configured = control
    ? {
        AllowedCPUs: expected.cpus,
        CPUQuotaPerSecUSec: cpuQuotaPerSecUsec(expected.cpuQuota),
        IOWeight: String(expected.ioWeight),
        MemoryMax: String(expected.memoryMax),
        MemorySwapMax: String(expected.memorySwapMax),
        TasksMax: String(expected.tasksMax),
      }
    : {
        AllowedCPUs: expected.cpus,
        CPUAccounting: expected.cpuAccounting,
        IOAccounting: expected.ioAccounting,
        MemoryAccounting: expected.memoryAccounting,
        MemoryMax: String(expected.memoryMax),
        MemorySwapMax: String(expected.memorySwapMax),
        TasksMax: String(expected.tasksMax),
      };
  const effective = control
    ? {
        'cpu.max': cpuMax(expected.cpuQuota),
        'cpuset.cpus.effective': expected.cpus,
        'io.weight': `default ${expected.ioWeight}`,
        'memory.max': String(expected.memoryMax),
        'memory.swap.max': String(expected.memorySwapMax),
        'pids.max': String(expected.tasksMax),
      }
    : {
        'cpuset.cpus.effective': expected.cpus,
        'memory.max': String(expected.memoryMax),
        'memory.swap.max': String(expected.memorySwapMax),
        'pids.max': String(expected.tasksMax),
      };
  exact(value?.configured, Object.keys(configured), `configured ${kind}`);
  exact(value?.effective, Object.keys(effective), `effective ${kind}`);
  for (const [key, expectedValue] of Object.entries(configured))
    same(value.configured[key], expectedValue, `${kind} ${key}`);
  for (const [key, expectedValue] of Object.entries(effective))
    same(value.effective[key], expectedValue, `${kind} ${key}`);
}

export function validateHostControlEvidence(policy, contract, evidence) {
  if (evidence?.timeout === true) fail('host command timeout');
  exact(
    evidence,
    ['binary', 'configured', 'effective', 'runnerArchiveSha256'],
    'host evidence'
  );
  const { control, measurement } = cgroups(policy, contract);
  const runner = policy?.supplyChain?.runner;
  if (
    !runner ||
    typeof runner.version !== 'string' ||
    !SHA256.test(runner.sha256)
  )
    fail('runner policy');
  exact(
    evidence.binary,
    ['mode', 'path', 'sha256', 'symlink', 'uidGid', 'version'],
    'runner binary'
  );
  for (const [actual, expected, name] of [
    [
      evidence.binary.path,
      '/srv/baci-cwv/sealed/actions-runner/bin/Runner.Listener',
      'runner binary path',
    ],
    [evidence.binary.uidGid, '0:10001', 'runner binary owner'],
    [evidence.binary.mode, '0550', 'runner binary mode'],
    [evidence.binary.symlink, false, 'runner binary symlink'],
    [evidence.binary.version, runner.version, 'runner binary version'],
    [evidence.runnerArchiveSha256, runner.sha256, 'runner archive SHA'],
  ])
    same(actual, expected, name);
  if (!SHA256.test(evidence.binary.sha256)) fail('runner binary SHA');
  exact(evidence.configured, ['control', 'measurement'], 'configured cgroups');
  exact(evidence.effective, ['control', 'measurement'], 'effective cgroups');
  validateCgroup(
    {
      configured: evidence.configured.control,
      effective: evidence.effective.control,
    },
    control,
    'control',
    true
  );
  validateCgroup(
    {
      configured: evidence.configured.measurement,
      effective: evidence.effective.measurement,
    },
    measurement,
    'measurement',
    false
  );
  return evidence;
}
