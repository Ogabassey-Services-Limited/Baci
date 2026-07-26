import { verifyRegistrationAuthority } from './registration-root-authority.mjs';
import { createRegistrationExclusiveGuard } from './registration-root-guard.mjs';

const DOCKER = '/usr/bin/docker';
const fail = () => {
  throw new TypeError('registration root system refused');
};

export const dedicatedContainerInventoryArgv = (dockerPrefix) => [
  ...dockerPrefix,
  'container',
  'ls',
  '--all',
  '--no-trunc',
  '--format',
  '{{.ID}}\t{{.Names}}\t{{.State}}',
];

export function createRegistrationSystemGuard(
  configuration,
  dependencies,
  execute,
  network,
  dockerPrefix
) {
  const verifyAuthority =
    dependencies.verifyAuthority ??
    ((authority) =>
      verifyRegistrationAuthority(
        authority,
        configuration,
        dependencies,
        execute
      ));
  const guard =
    dependencies.guard ??
    (dependencies.verifyAuthority
      ? async () => ({})
      : createRegistrationExclusiveGuard(configuration, {
          defaultDrop: network.setDefaultDrop,
          inspectDedicated: async () => ({
            containers: (
              await execute(DOCKER, [
                ...dedicatedContainerInventoryArgv(dockerPrefix),
              ])
            )
              .trimEnd()
              .split('\n')
              .filter(Boolean)
              .map((row) => {
                const [id, name, state, extra] = row.split('\t');
                if (extra || !/^[a-f0-9]{64}$/.test(id) || !name || !state)
                  fail();
                return { id, name, state };
              })
              .filter(({ name }) => name.startsWith('baci-cwv-registration-')),
          }),
          kill: async (container) => {
            try {
              await execute(DOCKER, [...dockerPrefix, 'kill', container]);
            } catch {
              /* already gone */
            }
          },
        }));
  return { guard, verifyAuthority };
}
