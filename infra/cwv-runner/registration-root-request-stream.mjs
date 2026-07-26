import { readRegistrationRootConfiguration } from './registration-root-configuration.mjs';
import { parseRegistrationRootRequest } from './registration-root-contract.mjs';
import {
  createRegistrationRootBackend,
  registrationRootOutput,
} from './registration-root-operations.mjs';

const fail = () => {
  throw new TypeError('registration root operation refused');
};

export async function runRegistrationRootServer(argv, dependencies = {}) {
  const stderr = dependencies.stderr ?? process.stderr;
  const stdout = dependencies.stdout ?? process.stdout;
  const stdin = dependencies.stdin ?? process.stdin;
  try {
    if (!Array.isArray(argv) || argv.length !== 1 || argv[0] !== '--execute')
      fail();
    const readConfiguration =
      dependencies.readConfiguration ?? readRegistrationRootConfiguration;
    const createBackend =
      dependencies.createBackend ?? createRegistrationRootBackend;
    if (
      typeof readConfiguration !== 'function' ||
      typeof createBackend !== 'function'
    )
      fail();
    const backend = createBackend(await readConfiguration());
    if (
      typeof backend !== 'function' ||
      !stdin ||
      typeof stdin[Symbol.asyncIterator] !== 'function'
    )
      fail();
    let pending = Buffer.alloc(0);
    for await (const chunk of stdin) {
      if (!Buffer.isBuffer(chunk) || pending.length + chunk.length > 16_384)
        fail();
      pending = Buffer.concat([pending, chunk]);
      let end = pending.indexOf(10);
      while (end >= 0) {
        const request = parseRegistrationRootRequest(
          pending.subarray(0, end + 1)
        );
        pending = pending.subarray(end + 1);
        stdout.write(
          registrationRootOutput(
            await backend(request.operation, request.context)
          )
        );
        end = pending.indexOf(10);
      }
    }
    if (pending.length) fail();
    return 0;
  } catch {
    stderr.write('registration root operation refused\n');
    return 65;
  }
}
