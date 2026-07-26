export function createNetworkCleanup({
  absent,
  bridge,
  check,
  docker,
  execute,
  identity,
  ip,
  iptables,
  network,
  subnet,
}) {
  const externalInterface = identity?.networkAuthority?.externalInterface;
  if (!/^[A-Za-z0-9_.-]{1,15}$/.test(externalInterface))
    throw new TypeError('registration root network refused');
  const natDelete = [
    '-w',
    '-t',
    'nat',
    '-D',
    'POSTROUTING',
    '-s',
    subnet,
    '-o',
    externalInterface,
    '-m',
    'comment',
    '--comment',
    identity.comment,
    '-j',
    'MASQUERADE',
  ];
  const natCheck = natDelete.map((value) => (value === '-D' ? '-C' : value));
  const anchors = [
    [
      '-w',
      '-D',
      'INPUT',
      '-m',
      'comment',
      '--comment',
      identity.comment,
      '-j',
      identity.input,
    ],
    [
      '-w',
      '-D',
      'DOCKER-USER',
      '-m',
      'comment',
      '--comment',
      identity.comment,
      '-j',
      identity.forward,
    ],
    natDelete,
  ];
  const hasTaggedNatRule = async () => {
    const rows = await execute(iptables, [
      '-w',
      '-t',
      'nat',
      '-S',
      'POSTROUTING',
    ]);
    if (typeof rows !== 'string')
      throw new TypeError('registration root network refused');
    const plain = `--comment ${identity.comment}`;
    const quoted = `--comment "${identity.comment}"`;
    return rows
      .split('\n')
      .some((row) => row.includes(plain) || row.includes(quoted));
  };
  const absentNetwork = () =>
    absent(docker, [
      `--host=${identity.socket}`,
      'network',
      'inspect',
      network,
    ]);
  return Object.freeze({
    async removeIsolation() {
      let removed = false;
      if ((await hasTaggedNatRule()) && !(await check(natCheck)))
        throw new TypeError('registration root network refused');
      for (const argv of anchors) {
        const present = argv.map((value) => (value === '-D' ? '-C' : value));
        if (!(await check(present))) continue;
        await execute(iptables, argv);
        if (await check(present))
          throw new TypeError('registration root network refused');
        removed = true;
      }
      for (const chain of [identity.input, identity.forward]) {
        if (!(await check(['-w', '-S', chain]))) continue;
        await execute(iptables, ['-w', '-F', chain]);
        await execute(iptables, ['-w', '-X', chain]);
        if (await check(['-w', '-S', chain]))
          throw new TypeError('registration root network refused');
        removed = true;
      }
      return { schemaVersion: 1, status: removed ? 'removed' : 'absent' };
    },
    async removeNetwork() {
      if (await absentNetwork()) return { schemaVersion: 1, status: 'absent' };
      await execute(docker, [
        `--host=${identity.socket}`,
        'network',
        'rm',
        network,
      ]);
      if (!(await absentNetwork()))
        throw new TypeError('registration root network refused');
      return { schemaVersion: 1, status: 'removed' };
    },
    async proveCleanupAbsence() {
      if (await hasTaggedNatRule())
        throw new TypeError('registration root network refused');
      for (const chain of [identity.input, identity.forward])
        if (!(await absent(iptables, ['-w', '-S', chain])))
          throw new TypeError('registration root network refused');
      for (const argv of anchors.map((rule) =>
        rule.map((value) => (value === '-D' ? '-C' : value))
      ))
        if (!(await absent(iptables, argv)))
          throw new TypeError('registration root network refused');
      if (
        !(await absentNetwork()) ||
        !(await absent(ip, ['link', 'show', 'dev', bridge]))
      )
        throw new TypeError('registration root network refused');
      return {
        bridgeAbsent: true,
        firewallAbsent: true,
        networkAbsent: true,
        schemaVersion: 1,
      };
    },
  });
}
