import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildArgv, policyBuildArguments } from './build-image.mjs';

const root = new URL('.', import.meta.url);
const names = [
  'SOURCE_MANIFEST_SHA256',
  'UBUNTU_IMAGE',
  'UBUNTU_SNAPSHOT',
  'UBUNTU_SOURCES_BASE64',
  'RUNNER_URL',
  'RUNNER_SHA256',
  'RUNNER_VERSION',
  'RUNNER_ASSET_ID',
  'RUNNER_ALLOWED_FINAL_ORIGINS',
  'COMMAND_SETTINGS_URL',
  'COMMAND_SETTINGS_SHA256',
  'COMMAND_SETTINGS_ALLOWED_FINAL_ORIGINS',
  'NODE_URL',
  'NODE_SHA256',
  'NODE_VERSION',
  'NODE_ALLOWED_FINAL_ORIGINS',
  'PNPM_METADATA_URL',
  'PNPM_URL',
  'PNPM_SHA256',
  'PNPM_INTEGRITY',
  'PNPM_SHA1',
  'PNPM_VERSION',
  'PNPM_ALLOWED_FINAL_ORIGINS',
  'CHROME_URL',
  'CHROME_SHA256',
  'CHROME_VERSION',
  'CHROME_ALLOWED_FINAL_ORIGINS',
  'CHROME_INRELEASE_SHA256',
  'CHROME_PACKAGES_SHA256',
  'CHROME_SIGNING_KEY_SHA256',
  'SUPPLY_CHAIN_PROVENANCE_JSON',
];
const tools = {
  'apt-get': '/usr/bin/apt-get',
  awk: '/usr/bin/awk',
  base64: '/usr/bin/base64',
  bash: '/usr/bin/bash',
  chmod: '/usr/bin/chmod',
  cp: '/usr/bin/cp',
  dpkg: '/usr/bin/dpkg',
  'dpkg-query': '/usr/bin/dpkg-query',
  find: '/usr/bin/find',
  gpgv: '/usr/bin/gpgv',
  grep: '/usr/bin/grep',
  ldd: '/usr/bin/ldd',
  mkdir: '/usr/bin/mkdir',
  mktemp: '/usr/bin/mktemp',
  mv: '/usr/bin/mv',
  readlink: '/usr/bin/readlink',
  rm: '/usr/bin/rm',
  sha256sum: '/usr/bin/sha256sum',
  sort: '/usr/bin/sort',
  stat: '/usr/bin/stat',
  timeout: '/usr/bin/timeout',
  wc: '/usr/bin/wc',
  keyring: '/usr/share/keyrings/ubuntu-archive-keyring.gpg',
};
test('projects the exact closed 31-name build arguments', () => {
  const source = 'c'.repeat(64);
  assert.deepEqual(
    Object.keys(policyBuildArguments(source)).sort(),
    [...names].sort()
  );
  assert.deepEqual(
    buildArgv('/tmp/image.tar', source)
      .flatMap((value, index, argv) =>
        argv[index - 1] === '--build-arg' ? [value.split('=', 1)[0]] : []
      )
      .sort(),
    [...names].sort()
  );
});
test('uses the closed verifier-stage scratch projection', () => {
  const file = readFileSync(new URL('Dockerfile', root), 'utf8');
  const declared = [...file.matchAll(/^ARG ([A-Z0-9_]+)$/gm)].map(
    (match) => match[1]
  );
  assert.deepEqual([...new Set(declared)].sort(), [...names].sort());
  assert.equal(declared.filter((name) => name === 'UBUNTU_IMAGE').length, 2);
  assert.equal(
    (file.match(/^COPY --from=verifier \/runtime-root\/ \/$/gm) ?? []).length,
    1
  );
  for (const value of [
    /^FROM \$\{UBUNTU_IMAGE\} AS verifier$/m,
    /^FROM scratch AS runtime$/m,
    /rm -rf \/etc\/apt \/usr\/share\/keyrings \/var\/lib\/apt/,
    /download-artifact\.sh .*verify-apt-snapshot\.sh/,
    /verify-base-tools\.sh "\$UBUNTU_IMAGE" "\$inventory"/,
    /\/opt\/baci-cwv\/verify-node-bootstrap\.sh "\$work/,
  ])
    assert.match(file, value);
  assert.doesNotMatch(
    file.split(/^FROM scratch AS runtime$/m)[1],
    /apt-get|download-artifact|\.deb|\.tar\.(?:gz|xz)/
  );
});
test('builds the scratch rootfs from declared package and artifact paths only', () => {
  const file = readFileSync(new URL('Dockerfile', root), 'utf8');
  assert.match(file, /rootfs-projection\.json/);
  assert.match(file, /runtime_packages=\(/);
  assert.match(file, /dpkg-query -L "\$package"/);
  const runtimePackages = file.match(/runtime_packages=\([\s\S]*?\);/)?.[0];
  assert.ok(runtimePackages);
  assert.doesNotMatch(runtimePackages, /\b(?:gpgv|unzip|xz-utils)\b/);
  assert.doesNotMatch(file, /-C \/ -cf - bin etc lib lib64 opt sbin usr var/);
  assert.doesNotMatch(file, /COPY --from=verifier \/usr/);
});
test('seals raw-archive membership before inventory and the process map', () => {
  const file = readFileSync(new URL('Dockerfile', root), 'utf8');
  for (const pattern of [
    /rootfs-source-inventory\.mjs write "\$inventory"[^;]+ "\/"/,
    /rootfs-source-membership-input\.mjs write/,
    /rootfs-source-membership-write\.mjs write/,
    /inventory_path deb "\$package" "\$source_sha" "\$path"/,
    /inventory_path "\$source_kind" "\$source_owner" "\$source_sha" "\$path"/,
    /source_sha=\$\(package_sha "\$package"\) \|\| exit 1/,
    /rootfs-source-inventory\.json/,
    /rootfs-source-membership\.json/,
  ])
    assert.match(file, pattern);
  assert.ok(
    file.indexOf('rootfs-source-membership-write.mjs write') <
      file.indexOf('rootfs-source-inventory.mjs write') &&
      file.indexOf('rootfs-source-inventory.mjs write') <
        file.indexOf('image-process-map.mjs write')
  );
});
test('binds every projected dependency link and target to one pinned source', () => {
  const file = readFileSync(new URL('Dockerfile', root), 'utf8');
  assert.match(file, /inventory_dependency\(\)/);
  assert.match(
    file,
    /project_path "\$path" closure "\$owner"; inventory_dependency "\$path"/
  );
  assert.match(
    file,
    /project_path "\$canonical" closure "\$owner"; inventory_dependency "\$canonical"/
  );
});
test('generates identity, trust, and writable runtime state explicitly', () => {
  const file = readFileSync(new URL('Dockerfile', root), 'utf8');
  for (const path of [
    '/bin/sh',
    '/etc/passwd',
    '/etc/group',
    '/etc/ssl/certs/ca-certificates.crt',
    '/home/runner',
    '/registration-staging',
    '/runner-work',
    '/opt/runner/_diag',
    '/tmp/baci-cwv',
  ])
    assert.match(file, new RegExp(path.replaceAll('/', '\\/')));
  // biome-ignore format: generated identity/trust and OCI user are one closed cross-binding.
  for (const pattern of [/project_directory \/home\/runner/, /printf '%b' 'runner:x:10001:10001:Baci CWV Runner:\/home\/runner:\/bin\/bash\\n'/, /printf '%b' 'runner:x:10001:\\n'/, /generated identity etc\/passwd/, /generated identity etc\/group/, /generated trust etc\/ssl\/certs\/ca-certificates\.crt/, /awk[^\n]+\/etc\/ca-certificates\.conf[^\n]+sort -u/, /while IFS= read -r certificate; do cat "\$certificate"; done/, /^USER runner$/m, /^(?![\s\S]*\b(?:groupadd|useradd)\b)[\s\S]*$/]) assert.match(file, pattern);
});
test('binds the verified base-tool receipt digest into Node bootstrap authorization', () => {
  const file = readFileSync(new URL('Dockerfile', root), 'utf8');
  assert.match(
    file,
    /base_tools_receipt_sha=\$\(\/opt\/baci-cwv\/verify-base-tools\.sh "\$UBUNTU_IMAGE" \/opt\/baci-cwv\/base-tools\.tsv "\$work\/base-tools-before-node\.json"\);/
  );
  assert.match(
    file,
    /"\$base_tools_receipt_sha" \\\n\s+"\$work\/base-tools-before-node\.json" "\$work\/node-receipt\.json"\);/
  );
  assert.match(
    file,
    /verify-node-bootstrap\.sh augment "\$work\/node-receipt\.json" "\$node_receipt_sha" "\$work\/base-tools-before-node\.json" "\$base_tools_receipt_sha" "\$work\/node\/bin\/node" "\$work\/node-provenance\.json"/
  );
});
test('projects the closed interpreter and shared-library graph', () => {
  const file = readFileSync(new URL('Dockerfile', root), 'utf8');
  const roots = file.match(/closure_roots=\([\s\S]*?\);/)?.[0];
  assert.ok(roots);
  assert.deepEqual(
    [...roots.matchAll(/([a-z-]+:\/[^\s)\\]+)/g)].map((match) => match[1]),
    [
      'shell:/bin/sh',
      'runtime-node:/opt/node/bin/node',
      'chrome:/opt/google/chrome/chrome',
      'listener:/opt/runner/bin/Runner.Listener',
      'worker:/opt/runner/bin/Runner.Worker',
      'plugin-host:/opt/runner/bin/Runner.PluginHost',
      'action-node:/opt/runner/externals/node24/bin/node',
      'dpkg-query:/usr/bin/dpkg-query',
      'isolation-probe:/usr/bin/mawk',
    ]
  );
  assert.match(file, /project_closure\(\)/);
  // biome-ignore format: generated alternatives remain one exact Docker projection contract.
  assert.match(file, /project_path \/usr\/bin\/awk generated awk-alternative; project_path \/etc\/alternatives\/awk generated awk-alternative/);
  assert.match(file, /runtime_packages=\([^;]+\bmawk\b/);
  assert.doesNotMatch(file, /project_path \/usr\/bin\/awk package mawk/);
  assert.match(file, /ldd "\$canonical"/);
  assert.match(file, /grep -q 'not found'/);
});
// biome-ignore format: the frozen root inventory is one source-bound Dockerfile contract.
test('derives every runtime-package ELF closure from one frozen root set', () => { const file = readFileSync(new URL('Dockerfile', root), 'utf8'); const expected = ['bash', 'ca-certificates', 'coreutils', 'curl', 'dash', 'fonts-liberation', 'git', 'grep', 'google-chrome-stable', 'iproute2', 'jq', 'libasound2t64', 'libatk-bridge2.0-0', 'libc6', 'libcups2', 'libgbm1', 'libgtk-3-0t64', 'libnspr4', 'libnss3', 'libudev1', 'libvulkan1', 'mawk', 'procps', 'util-linux', 'xdg-utils']; const roots = file.match(/runtime_packages=\([\s\S]*?\);/)?.[0]; assert.ok(roots); const declared = roots.slice('runtime_packages=('.length, -2).trim().split(/\s+/); assert.deepEqual(declared, expected); assert.match(file, /while IFS= read -r path; do \\\n\s+is_elf_regular_file "\$path" \|\| continue; \\\n\s+project_closure "runtime-package-\$package" "\$path"; \\\n\s+done < <\(dpkg-query -L "\$package"\)/); assert.match(file, /runtime_executable_root_packages=\("\$\{runtime_packages\[@\]\}"\)/); assert.ok(file.indexOf('for pair in "$' + '{closure_roots[@]}"') < file.indexOf('for package in "$' + '{runtime_executable_root_packages[@]}"')); });
// biome-ignore format: receipt, source archive, and package-sha closure remain one exact Docker contract.
test('derives every non-root closure owner from runtime ELF metadata before pinning sources', () => { const file = readFileSync(new URL('Dockerfile', root), 'utf8'); assert.match(file, /closure_source_packages\(\)[\s\S]*ldd "\$canonical"[\s\S]*cat \/tmp\/base-libraries/); assert.match(file, /dpkg-query -S "\$\(readlink -f "\$path"\)"/); assert.match(file, /runtime_closure_source_packages=\(\$\(closure_source_packages\)\)/); assert.match(file, /--download-only --reinstall install[^;]+"\$\{runtime_closure_source_packages\[@\]\}"/); assert.doesNotMatch(file, /runtime_closure_source_packages=\(libgcc-s1 libstdc\+\+6\)/); assert.match(file, /package_sha "\$package"/); assert.match(file, /COPY[^\n]*supply-chain-provenance\.mjs[^\n]*openpgp-keyring\.mjs[^\n]*\/opt\/baci-cwv\//); assert.match(file, /rm -f[^;]*openpgp-keyring\.mjs/); const runtimeBaci = file.match(/baci_paths=\([\s\S]*?\);/)?.[0]; assert.ok(runtimeBaci); assert.doesNotMatch(runtimeBaci, /openpgp-keyring/); });
// biome-ignore format: this is a real ldd transcript and its parser must remain byte-identical to Dockerfile.
test('parses an indented ELF interpreter row into the sealed closure', () => { const file = readFileSync(new URL('Dockerfile', root), 'utf8'); assert.ok(file.includes("ldd_paths() { awk '{ for (i = 1; i <= NF; i++) if ($i ~ /^\\//) print $i }'")); assert.ok(file.includes("done | awk '{ for (i=1; i<=NF; i++) if ($i ~ /^\\//) print $i }'")); const output = 'libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x1)\n  /lib64/ld-linux-x86-64.so.2 (0x2)\n'; const paths = execFileSync('awk', ['{ for (i = 1; i <= NF; i++) if ($i ~ /^\\//) print $i }'], { encoding: 'utf8', input: output }).trim().split('\n'); assert.deepEqual(paths, ['/lib/x86_64-linux-gnu/libc.so.6', '/lib64/ld-linux-x86-64.so.2']); });
// biome-ignore format: one exact artifact-root inventory protects the scratch closure boundary.
test('closes every regular ELF from every pinned artifact root', () => { const file = readFileSync(new URL('Dockerfile', root), 'utf8'); assert.match(file, /is_elf_regular_file\(\).*head -c 4/); assert.match(file, /find "\$root" -xdev -type f -print0/); assert.match(file, /project_artifact_elf_closures listener \/opt\/runner; project_artifact_elf_closures chrome \/opt\/google; project_artifact_elf_closures runtime-node \/opt\/node; project_artifact_elf_closures runtime-node \/opt\/pnpm/); });
test('binds installed vendor paths to exact archive transforms and signed Chrome package identity', () => {
  const file = readFileSync(new URL('Dockerfile', root), 'utf8');
  assert.match(file, /chrome_filename=.*CHROME_URL/);
  assert.match(
    file,
    /project_artifact chrome \/opt\/google "\$CHROME_SHA256" deb google-chrome-stable/
  );
  for (const expected of [
    /"google-chrome-stable":\{[\s\S]*?installPrefix:""[\s\S]*?kind:"deb"[\s\S]*?filename:\$chromeFilename[\s\S]*?stripComponents:0\}/,
    /node:\{[\s\S]*?installPrefix:"opt\/node"[\s\S]*?stripComponents:1\}/,
    /pnpm:\{[\s\S]*?installPrefix:"opt\/pnpm"[\s\S]*?stripComponents:1\}/,
    /runner:\{[\s\S]*?installPrefix:"opt\/runner"[\s\S]*?stripComponents:0\}/,
  ])
    assert.match(file, expected);
  assert.doesNotMatch(file, /pool\/google-chrome-stable\.deb/);
});
test('projects only the immutable dpkg query surface required by the collector', () => {
  const file = readFileSync(new URL('Dockerfile', root), 'utf8');
  assert.match(file, /project_path \/usr\/bin\/dpkg-query package dpkg/);
  assert.doesNotMatch(file, /project_path \/var\/lib\/dpkg\/status/);
  assert.match(
    file,
    /Package: %s\\nStatus: install ok installed\\nArchitecture: %s\\nVersion: %s\\n/
  );
  assert.match(file, /chmod 0444 \/runtime-root\/var\/lib\/dpkg\/status/);
  assert.match(file, /generated dpkg-query var\/lib\/dpkg\/status/);
  assert.match(file, /dpkg-query:\/usr\/bin\/dpkg-query/);
  assert.match(file, /find \/runtime-root\/var\/lib\/dpkg[^;]+status/);
  assert.doesNotMatch(
    file,
    /project_path \/var\/lib\/dpkg\/(?:available|updates|info)/
  );
});
test('assigns every projected Chrome path to one authority', () => {
  const file = readFileSync(new URL('Dockerfile', root), 'utf8');
  assert.match(
    file,
    /"\$package" = google-chrome-stable[^\n]*"\$path" = \/opt\/google\/\*/
  );
  assert.match(file, /awk -F '\\t'[^\n]*\$3 == path/);
  assert.match(
    file,
    /awk -F '\\t' '\{ print \$3 \}' "\$projection" \| sort -u/
  );
});
test('derives one frozen artifact size cap and supplies it to every artifact fetch', () => {
  const file = readFileSync(new URL('Dockerfile', root), 'utf8');
  assert.match(
    file,
    /artifact_max_bytes=\$\(printf '%s' "\$SUPPLY_CHAIN_PROVENANCE_JSON" \| awk/
  );
  const calls = [
    ...file.matchAll(/^\s+\/opt\/baci-cwv\/download-artifact\.sh([\s\S]*?);/gm),
  ];
  assert.equal(calls.length, 9);
  for (const call of calls) assert.match(call[0], /"\$artifact_max_bytes"/);
});
test('inventories every pre-install external base command', () => {
  const file = readFileSync(new URL('Dockerfile', root), 'utf8');
  const block = file
    .match(
      /RUN set -euo pipefail;[\s\S]*?dpkg -i "\$apt_work"\/archives\/\*\.deb/
    )?.[0]
    .replaceAll('\\\n', ' ');
  assert.ok(block);
  assert.deepEqual(
    Object.fromEntries(
      [...block.matchAll(/\bemit ([a-z0-9-]+) (\/[^;\s]+)/g)].map((match) => [
        match[1],
        match[2],
      ])
    ),
    tools
  );
  const closure = block.match(/closure_tools=\([\s\S]*?\);/)?.[0];
  assert.ok(closure);
  assert.match(closure, /\/usr\/bin\/cp/);
  assert.match(closure, /\/usr\/bin\/timeout/);
  assert.match(block, /emit awk \/usr\/bin\/awk \/usr\/bin\/mawk/);
  assert.match(
    block,
    /emit awk:alternative \/etc\/alternatives\/awk \/usr\/bin\/mawk/
  );
  assert.match(block, /emit awk:target \/usr\/bin\/mawk/);
});
