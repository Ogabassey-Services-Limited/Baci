import { readFile, readlink } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';

const DOCKER = '/usr/bin/docker';
const fail = () => {
  throw new TypeError('registration root system refused');
};

export async function verifyRegistrationAuthority(
  authority,
  configuration,
  dependencies,
  execute
) {
  const name = `baci-cwv-registration-${configuration.context.registrationNonce}`;
  const raw = await execute(DOCKER, [
    `--host=${configuration.resources.dockerSocket}`,
    'inspect',
    '--format',
    '{{json [ .Id, .State.Running, .State.Pid ]}}',
    name,
  ]);
  let projection;
  try {
    projection = JSON.parse(raw);
  } catch {
    fail();
  }
  if (
    !isDeepStrictEqual(projection, [
      authority.containerId,
      true,
      authority.listenerPid,
    ])
  )
    fail();
  const link = dependencies.readlink ?? readlink;
  const read = dependencies.readFile ?? readFile;
  const root = `/proc/${authority.listenerPid}`;
  const [cgroupNamespace, mountNamespace, userNamespace, cgroupBytes] =
    await Promise.all([
      link(`${root}/ns/cgroup`),
      link(`${root}/ns/mnt`),
      link(`${root}/ns/user`),
      read(`${root}/cgroup`),
    ]);
  if (
    !isDeepStrictEqual(
      [cgroupNamespace, mountNamespace, userNamespace],
      [
        authority.cgroupNamespace,
        authority.mountNamespace,
        authority.userNamespace,
      ]
    ) ||
    cgroupBytes.toString('utf8').trim().replace(/^0::/, '/sys/fs/cgroup') !==
      authority.runtimeIdentity.cgroupPath
  )
    fail();
}
