function nonNegativeInteger(value, label) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(`${label} must be a non-negative integer string`);
  }
  return BigInt(value);
}

function requiredString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function jobRows(snapshot, label) {
  const rows = snapshot?.cron?.job_identities;
  if (!Array.isArray(rows)) {
    throw new Error(`${label}.cron.job_identities must be an array`);
  }
  const jobs = snapshot?.cron?.jobs;
  if (!jobs || typeof jobs !== 'object') {
    throw new Error(`${label}.cron.jobs must be an object`);
  }
  const identities = new Map();
  let active = 0n;
  rows.forEach((row, index) => {
    const entry = `${label}.cron.job_identities[${index}]`;
    const jobid = nonNegativeInteger(row?.jobid, `${entry}.jobid`).toString();
    const schedule = requiredString(row?.schedule, `${entry}.schedule`);
    const commandDigest = requiredString(
      row?.command_digest,
      `${entry}.command_digest`
    );
    const targetDigest = requiredString(
      row?.target_digest,
      `${entry}.target_digest`
    );
    if (!/^[a-f0-9]{32}$/i.test(commandDigest)) {
      throw new Error(`${entry}.command_digest must be an MD5 digest`);
    }
    if (!/^[a-f0-9]{32}$/i.test(targetDigest)) {
      throw new Error(`${entry}.target_digest must be an MD5 digest`);
    }
    if (typeof row?.active !== 'boolean') {
      throw new Error(`${entry}.active must be a boolean`);
    }
    const identity = [jobid, schedule, commandDigest, targetDigest].join(
      '\u001f'
    );
    if (identities.has(identity)) {
      throw new Error(`${label}.cron.job_identities contains a duplicate job`);
    }
    identities.set(identity, row.active);
    if (row.active) active += 1n;
  });
  if (
    nonNegativeInteger(jobs.total, `${label}.cron.jobs.total`) !==
    BigInt(rows.length)
  ) {
    throw new Error(`${label}.cron.job_identities does not match jobs.total`);
  }
  if (nonNegativeInteger(jobs.active, `${label}.cron.jobs.active`) !== active) {
    throw new Error(`${label}.cron.job_identities does not match jobs.active`);
  }
  return identities;
}

export function validateCronJobIdentities(before, after) {
  const beforeJobs = jobRows(before, 'before');
  const afterJobs = jobRows(after, 'after');
  for (const [identity, active] of beforeJobs) {
    if (!afterJobs.has(identity)) {
      throw new Error('cron workload identity changed during interval');
    }
    if (afterJobs.get(identity) !== active) {
      throw new Error('cron job activity changed during interval');
    }
  }
  for (const identity of afterJobs.keys()) {
    if (!beforeJobs.has(identity)) {
      throw new Error('cron workload identity changed during interval');
    }
  }
}
