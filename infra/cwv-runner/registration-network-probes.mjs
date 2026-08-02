export function createNetworkProbes({
  campaign,
  docker,
  fail,
  image,
  network,
  networkAuthority,
}) {
  const uids = networkAuthority?.nonrootServiceUids;
  if (!Array.isArray(uids) || uids.length === 0) fail();
  return Object.freeze({
    async probeCrossUid() {
      const name = `baci-cwv-uid-owner-${campaign}`;
      const id = await docker(
        'run',
        '--pull=never',
        '--detach',
        `--name=${name}`,
        '--network=none',
        '--read-only',
        '--cap-drop=ALL',
        '--security-opt=no-new-privileges=true',
        '--user=0:0',
        '--entrypoint=/bin/sh',
        image,
        '-ceu',
        'exec /bin/sleep 30'
      );
      if (!/^[a-f0-9]{64}\n$/.test(id)) fail();
      try {
        for (const uid of uids) {
          const raw = await docker(
            'run',
            '--pull=never',
            '--rm',
            `--pid=container:${name}`,
            '--network=none',
            '--read-only',
            '--cap-drop=ALL',
            '--security-opt=no-new-privileges=true',
            `--user=${uid}:${uid}`,
            '--entrypoint=/bin/sh',
            image,
            '-ceu',
            'test ! -r /proc/1/environ; printf "%s\\n" cross-uid-environ-denied'
          );
          if (raw !== 'cross-uid-environ-denied\n') fail();
        }
      } finally {
        await docker('rm', '--force', name);
      }
    },
    async probePublicTls() {
      const raw = await docker(
        'run',
        '--pull=never',
        '--rm',
        `--network=${network}`,
        '--read-only',
        '--cap-drop=ALL',
        '--security-opt=no-new-privileges=true',
        '--user=10001:10001',
        '--entrypoint=/bin/sh',
        image,
        '-ceu',
        `answers=$(/usr/bin/getent ahostsv4 api.github.com | /usr/bin/awk '{print $1}' | /usr/bin/sort -u); [ -n "$answers" ]; for address in $answers; do case $address in 127.*|10.*|172.16.*|172.17.*|172.18.*|172.19.*|172.2[0-9].*|172.3[0-1].*|192.168.*|169.254.*) exit 1;; esac; /usr/bin/curl --fail --silent --show-error --proto =https --tlsv1.2 --connect-timeout 5 --max-time 15 --resolve api.github.com:443:$address https://api.github.com/meta >/dev/null; done; for denied in http://172.31.255.1 http://127.0.0.1 http://10.0.0.1 http://192.168.0.1; do if /usr/bin/curl --fail --silent --show-error --connect-timeout 1 --max-time 2 $denied >/dev/null 2>&1; then exit 1; fi; done; printf "%s\\n" dns-tls-sni-ok`
      );
      if (raw !== 'dns-tls-sni-ok\n') fail();
    },
  });
}
