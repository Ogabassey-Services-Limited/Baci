#!/bin/sh
set -eu

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH LC_ALL=C.UTF-8 TZ=Etc/UTC
umask 077

SCRIPT_DIR=$(CDPATH='' cd -- "$(/usr/bin/dirname -- "$0")" && /bin/pwd -P)
readonly SCRIPT_DIR STATE_ROOT=/srv/baci-cwv/campaigns
readonly CONTRACT="$SCRIPT_DIR/identity-contract.json"
readonly POLICY="$SCRIPT_DIR/policy.json"
readonly POLICY_TOOL="$SCRIPT_DIR/policy.schema.mjs"
readonly RUNNER_PROJECTION_TOOL="$SCRIPT_DIR/runner-runtime-projection.mjs"
readonly EMPTY_HOME=/var/empty/baci-cwv
readonly COMMAND_TIMEOUT=15s
usage() { printf '%s\n' 'usage: host-attest.sh --identity-host|--live-local <campaign-id>' >&2; exit 64; }
fail() { printf '%s\n' "$1" >&2; exit 65; }
canonical_id() { printf '%s' "$1" | /usr/bin/grep -Eq '^[a-z0-9][a-z0-9-]{0,62}$'; }
one_line() { value=$(/usr/bin/sed -n '1p' "$1"); [ "$(/usr/bin/wc -l <"$1" | /usr/bin/tr -d ' ')" = 1 ] && printf '%s\n' "$value"; }
capture() {
  output=$1 error=$2; shift 2
  /usr/bin/timeout --signal=TERM --kill-after=1s "$COMMAND_TIMEOUT" "$@" >"$output" 2>"$error" || fail 'host command failed or timed out'
  [ ! -s "$error" ] || fail 'host command stderr'
}
hash() {
  temporary_hash=$(/usr/bin/mktemp /run/baci-cwv-host-hash.XXXXXX) || fail 'hash temporary unavailable'
  capture "$temporary_hash" "$temporary_hash.err" /usr/bin/sha256sum "$1"
  IFS=' ' read -r value _ <"$temporary_hash" || fail 'hash output'
  /bin/rm -f -- "$temporary_hash" "$temporary_hash.err"
  printf '%s\n' "$value"
}
assert_contract() {
  [ -f "$CONTRACT" ] && [ ! -L "$CONTRACT" ] || fail 'identity contract missing'
  [ -f "$POLICY" ] && [ ! -L "$POLICY" ] || fail 'policy missing'
  [ -f "$POLICY_TOOL" ] && [ ! -L "$POLICY_TOOL" ] || fail 'policy schema missing'
  temporary_contract=$(/usr/bin/mktemp /run/baci-cwv-host-contract.XXXXXX) || fail 'contract temporary unavailable'
  capture "$temporary_contract" "$temporary_contract.err" /usr/bin/jq -e '.schemaVersion == 1' "$CONTRACT"
  capture "$temporary_contract.policy" "$temporary_contract.policy.err" /usr/bin/node "$POLICY_TOOL" get ''
  /bin/rm -f -- "$temporary_contract" "$temporary_contract.err" "$temporary_contract.policy" "$temporary_contract.policy.err"
}
assert_empty_root_home() {
  [ -d "$EMPTY_HOME" ] && [ ! -L "$EMPTY_HOME" ] || fail 'empty home missing'
  [ "$(/usr/bin/stat -c '%u:%a' -- "$EMPTY_HOME")" = 0:700 ] || fail 'empty home mode'
  [ -z "$(/usr/bin/find "$EMPTY_HOME" -mindepth 1 -maxdepth 1 -print -quit)" ] || fail 'empty home not empty'
}
assert_root_binary() {
  binary=$1
  [ -f "$binary" ] && [ ! -L "$binary" ] || fail 'binary missing or symlinked'
  [ "$(/usr/bin/stat -c '%u:%g:%a' -- "$binary")" = 0:0:755 ] || fail 'binary ownership or mode'
  [ "$(/usr/bin/readlink -f -- "$binary")" = "$binary" ] || fail 'binary resolved path'
}
assert_sealed_runner_projection() {
  runner_root=/srv/baci-cwv/sealed/actions-runner
  [ -f "$RUNNER_PROJECTION_TOOL" ] && [ ! -L "$RUNNER_PROJECTION_TOOL" ] || fail 'runner projection helper missing'
  [ "$(/usr/bin/stat -c '%u:%g:%a' -- "$RUNNER_PROJECTION_TOOL")" = 0:0:500 ] || fail 'runner projection helper metadata'
  /usr/bin/timeout --signal=TERM --kill-after=1s "$COMMAND_TIMEOUT" \
    /usr/bin/node --input-type=module - "$RUNNER_PROJECTION_TOOL" "$runner_root" <<'NODE' || fail 'sealed runner projection'
const [helper,root]=process.argv.slice(2);
const {inspectRunnerProjection,readRunnerImageId,readRunnerRuntimeManifest}=await import(`file://${helper}`);
const imageId=await readRunnerImageId();
const manifest=await readRunnerRuntimeManifest(imageId);
await inspectRunnerProjection(root,manifest,{uid:0,gid:10001},true);
NODE
}
reject_stderr() {
  output=$1 error=$2; shift 2
  "$@" >"$output" 2>"$error" || return 1
  [ ! -s "$error" ] || return 1
}
external_read() {
  output=$1; error=$2; url=$3
  reject_stderr "$output" "$error" /usr/bin/timeout --signal=TERM --kill-after=1s "$COMMAND_TIMEOUT" /usr/bin/env -i \
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    LC_ALL=C.UTF-8 TZ=Etc/UTC HOME=/var/empty/baci-cwv \
    /usr/bin/curl -q --config /dev/null --noproxy '*' --proto '=https' --tlsv1.2 \
    --cacert /etc/ssl/certs/ca-certificates.crt --fail --silent --show-error --max-time 10 "$url"
}
control_evidence() {
  root=$1
  runner=/srv/baci-cwv/sealed/actions-runner/bin/Runner.Listener
  assert_sealed_runner_projection
  [ -f "$runner" ] && [ ! -L "$runner" ] || fail 'runner binary missing'
  [ "$(/usr/bin/stat -c '%u:%g:%a' -- "$runner")" = 0:10001:550 ] || fail 'runner binary ownership'
  hash "$runner" >"$root/runner.sha256" || fail 'runner binary hash'
  capture "$root/runner.version" "$root/runner.version.err" "$runner" --version
  capture "$root/control.configured" "$root/control.configured.err" /bin/systemctl show cwv-measurement-control.slice --property=AllowedCPUs,CPUQuotaPerSecUSec,IOWeight,MemoryMax,MemorySwapMax,TasksMax
  capture "$root/measurement.configured" "$root/measurement.configured.err" /bin/systemctl show cwv-measurement.slice --property=AllowedCPUs,CPUAccounting,IOAccounting,MemoryAccounting,MemoryMax,MemorySwapMax,TasksMax
  capture "$root/control.group" "$root/control.group.err" /bin/systemctl show cwv-measurement-control.slice --property=ControlGroup --value
  capture "$root/measurement.group" "$root/measurement.group.err" /bin/systemctl show cwv-measurement.slice --property=ControlGroup --value
  control_group=$(one_line "$root/control.group") || fail 'control cgroup output'
  measurement_group=$(one_line "$root/measurement.group") || fail 'measurement cgroup output'
  for group in "$control_group" "$measurement_group"; do
    printf '%s' "$group" | /usr/bin/grep -Eq '^/[A-Za-z0-9_.@/-]+$' || fail 'cgroup path invalid'
    [ -d "/sys/fs/cgroup$group" ] && [ ! -L "/sys/fs/cgroup$group" ] || fail 'cgroup missing'
  done
  for name in cpuset.cpus.effective cpu.max io.weight memory.max memory.swap.max pids.max; do
    capture "$root/control.$name" "$root/control.$name.err" /bin/cat "/sys/fs/cgroup$control_group/$name"
  done
  for name in cpuset.cpus.effective memory.max memory.swap.max pids.max; do
    capture "$root/measurement.$name" "$root/measurement.$name.err" /bin/cat "/sys/fs/cgroup$measurement_group/$name"
  done
  /usr/bin/timeout --signal=TERM --kill-after=1s "$COMMAND_TIMEOUT" /usr/bin/node --input-type=module - "$POLICY" "$CONTRACT" "$root" "$SCRIPT_DIR/host-attestation-normalize.mjs" <<'NODE'
import fs from 'node:fs';
const [policyPath,contractPath,root,helper]=process.argv.slice(2);
const {validateHostControlEvidence}=await import(`file://${helper}`);
const read=(name)=>{const value=fs.readFileSync(`${root}/${name}`,'utf8');if(!value.endsWith('\n')||value.slice(0,-1).includes('\n'))throw Error(`${name} output`);return value.slice(0,-1)};
const pairs=(name)=>{const rows=read(name).split('\n').map((line)=>line.split('='));if(rows.some((row)=>row.length!==2||!row[0]||row[1].includes('='))||new Set(rows.map(([key])=>key)).size!==rows.length)throw Error(`${name} malformed`);return Object.fromEntries(rows);};
const cgroup=(name,keys)=>Object.fromEntries(keys.map((key)=>[key,read(`${name}.${key}`)]));
const evidence={binary:{path:'/srv/baci-cwv/sealed/actions-runner/bin/Runner.Listener',uidGid:'0:10001',mode:'0550',sha256:read('runner.sha256'),symlink:false,version:read('runner.version')},runnerArchiveSha256:JSON.parse(fs.readFileSync(policyPath,'utf8')).supplyChain.runner.sha256,configured:{control:pairs('control.configured'),measurement:pairs('measurement.configured')},effective:{control:cgroup('control',['cpuset.cpus.effective','cpu.max','io.weight','memory.max','memory.swap.max','pids.max']),measurement:cgroup('measurement',['cpuset.cpus.effective','memory.max','memory.swap.max','pids.max'])}};
validateHostControlEvidence(JSON.parse(fs.readFileSync(policyPath,'utf8')),JSON.parse(fs.readFileSync(contractPath,'utf8')),evidence);
process.stdout.write(`${JSON.stringify(evidence)}\n`);
NODE
}
identity_host() {
  assert_contract; assert_empty_root_home
  temporary=$(/usr/bin/mktemp -d /run/baci-cwv-host-attest.XXXXXX) || fail 'temporary unavailable'
  trap 'rm -rf -- "$temporary"' EXIT HUP INT TERM
  capture "$temporary/hostname" "$temporary/hostname.err" /bin/hostname --short
  hostname=$(one_line "$temporary/hostname") || fail 'hostname output'
  printf '%s' "$hostname" | /usr/bin/grep -Eq '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' || fail 'hostname invalid'
  capture "$temporary/cpu.json" "$temporary/cpu.err" /usr/bin/lscpu --json
  capture "$temporary/topology.json" "$temporary/topology.err" /usr/bin/lscpu --json --extended=CPU,ONLINE,SOCKET,CORE,NODE
  capture "$temporary/cpu-freq.json" "$temporary/cpu-freq.err" /usr/bin/node --input-type=module - <<'NODE'
import {lstatSync,readdirSync,readFileSync} from 'node:fs';
const root='/sys/devices/system/cpu'; const cpus=readdirSync(root).filter((name)=>/^cpu[0-9]+$/.test(name)).sort((a,b)=>Number(a.slice(3))-Number(b.slice(3)));
const pair=(cpu)=>`${root}/${cpu}/cpufreq`; const present=cpus.map((cpu)=>[cpu,pair(cpu)]).filter(([,path])=>{try{return lstatSync(path).isDirectory()}catch{return false}});
if(!present.length){process.stdout.write('{"cpufreqUnavailable":true}\n');process.exit(0)}
if(present.length!==cpus.length)throw Error('partial cpufreq coverage');
const records=present.map(([cpu,path])=>{const read=(name)=>{const file=`${path}/${name}`,stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('cpufreq file');const value=readFileSync(file,'utf8');if(!value.endsWith('\n')||value.slice(0,-1).includes('\n')||!value.slice(0,-1))throw Error('cpufreq value');return value.slice(0,-1)};return {cpu:Number(cpu.slice(3)),energyPerformancePreference:read('energy_performance_preference'),scalingGovernor:read('scaling_governor')}});
process.stdout.write(`${JSON.stringify({cpufreqUnavailable:false,records})}\n`);
NODE
  capture "$temporary/memory" "$temporary/memory.err" /usr/bin/grep '^MemTotal:' /proc/meminfo
  [ "$(/usr/bin/wc -l <"$temporary/memory" | /usr/bin/tr -d ' ')" = 1 ] || fail 'memory ambiguity'
  capture "$temporary/kernel" "$temporary/kernel.err" /usr/bin/uname -srmv
  capture "$temporary/os-release" "$temporary/os-release.err" /bin/cat /etc/os-release
  hash /etc/os-release >"$temporary/os-release.sha256"
  capture "$temporary/rootfs.json" "$temporary/rootfs.err" /usr/bin/findmnt --json --target / --output SOURCE,FSTYPE,OPTIONS
  capture "$temporary/route.json" "$temporary/route.err" /usr/sbin/ip --json route get 1.1.1.1
  capture "$temporary/dns.servers" "$temporary/dns.servers.err" /usr/bin/resolvectl dns eth0
  capture "$temporary/dns.default-route" "$temporary/dns.default-route.err" /usr/bin/resolvectl default-route eth0
  capture "$temporary/dns.status" "$temporary/dns.status.err" /usr/bin/resolvectl status
  capture "$temporary/locale.status" "$temporary/locale.status.err" /usr/bin/localectl status --no-pager
  capture "$temporary/locale.charmap" "$temporary/locale.charmap.err" /usr/bin/locale charmap
  capture "$temporary/timezone" "$temporary/timezone.err" /usr/bin/timedatectl show --property=Timezone --value
  capture "$temporary/cgroupfs" "$temporary/cgroupfs.err" /usr/bin/stat --file-system --format=%T /sys/fs/cgroup
  capture "$temporary/docker-info.json" "$temporary/docker-info.err" /usr/bin/env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin LC_ALL=C.UTF-8 TZ=Etc/UTC HOME=/var/empty/baci-cwv /usr/bin/docker --host unix:///run/baci-cwv/docker.sock info --format '{{json .}}'
  assert_root_binary /usr/bin/dockerd
  assert_root_binary /usr/bin/containerd
  assert_root_binary /usr/sbin/nft
  assert_root_binary /usr/sbin/xtables-nft-multi
  capture "$temporary/dockerd" "$temporary/dockerd.err" /usr/bin/dockerd --version
  hash /usr/bin/dockerd >"$temporary/dockerd.sha256"
  capture "$temporary/containerd" "$temporary/containerd.err" /usr/bin/containerd --version
  hash /usr/bin/containerd >"$temporary/containerd.sha256"
  [ -L /usr/sbin/iptables ] || fail 'iptables symlink missing'
  [ -L /usr/sbin/iptables-nft ] || fail 'iptables-nft symlink missing'
  capture "$temporary/iptables" "$temporary/iptables.err" /usr/sbin/iptables --version
  hash /usr/sbin/iptables >"$temporary/iptables.sha256"
  capture "$temporary/iptables.path" "$temporary/iptables.path.err" /usr/bin/readlink -f /usr/sbin/iptables
  capture "$temporary/iptables.link.stat" "$temporary/iptables.link.stat.err" /usr/bin/stat --format=%u:%g:%a /usr/sbin/iptables
  capture "$temporary/iptables.target.stat" "$temporary/iptables.target.stat.err" /usr/bin/stat --format=%u:%g:%a /usr/sbin/xtables-nft-multi
  hash /usr/sbin/xtables-nft-multi >"$temporary/iptables.target.sha256"
  capture "$temporary/iptables-nft.path" "$temporary/iptables-nft.path.err" /usr/bin/readlink -f /usr/sbin/iptables-nft
  capture "$temporary/iptables-nft.link.stat" "$temporary/iptables-nft.link.stat.err" /usr/bin/stat --format=%u:%g:%a /usr/sbin/iptables-nft
  capture "$temporary/iptables-nft.target.stat" "$temporary/iptables-nft.target.stat.err" /usr/bin/stat --format=%u:%g:%a /usr/sbin/xtables-nft-multi
  hash /usr/sbin/xtables-nft-multi >"$temporary/iptables-nft.target.sha256"
  capture "$temporary/nft" "$temporary/nft.err" /usr/sbin/nft --version
  hash /usr/sbin/nft >"$temporary/nft.sha256"
  capture "$temporary/ip-forward" "$temporary/ip-forward.err" /bin/cat /proc/sys/net/ipv4/ip_forward
  [ "$(one_line "$temporary/ip-forward")" = 1 ] || fail 'ip forwarding drift'
  external_read "$temporary/trace" "$temporary/trace.err" https://www.cloudflare.com/cdn-cgi/trace || fail 'egress trace'
  capture "$temporary/ip-forward-after" "$temporary/ip-forward-after.err" /bin/cat /proc/sys/net/ipv4/ip_forward
  [ "$(one_line "$temporary/ip-forward-after")" = 1 ] || fail 'ip forwarding drift'
  external_read "$temporary/rdap" "$temporary/rdap.err" https://rdap.db.ripe.net/ip/82.29.190.219 || fail 'egress provider'
  capture "$temporary/ip-forward-after-rdap" "$temporary/ip-forward-after-rdap.err" /bin/cat /proc/sys/net/ipv4/ip_forward
  [ "$(one_line "$temporary/ip-forward-after-rdap")" = 1 ] || fail 'ip forwarding drift'
  /bin/mkdir "$temporary/control-evidence" || fail 'stable cgroup evidence'
  control_evidence "$temporary/control-evidence" >"$temporary/control-evidence.json" || fail 'stable cgroup evidence'
  /usr/bin/timeout --signal=TERM --kill-after=1s "$COMMAND_TIMEOUT" /usr/bin/node --input-type=module - "$CONTRACT" "$hostname" "$temporary" "$SCRIPT_DIR/host-attestation-normalize.mjs" "$SCRIPT_DIR/host-attestation.mjs" <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const [contractPath,hostname,root,helper,attestationHelper]=process.argv.slice(2);
const {parseCloudflareTrace,parseDns,parseLocale,parseLscpuSummary,parseMemTotal,parseOsRelease}=await import(`file://${helper}`);
const {validateSealedRunnerIdentity}=await import(`file://${attestationHelper}`);
const contract=JSON.parse(fs.readFileSync(contractPath,'utf8'));
const read=(name)=>fs.readFileSync(`${root}/${name}`,'utf8');
const one=(name)=>{const v=read(name);if(!v.endsWith('\n')||v.slice(0,-1).includes('\n'))throw Error(`${name} ambiguity`);return v.slice(0,-1)};
const json=(name)=>JSON.parse(read(name));
const trace=parseCloudflareTrace(read('trace'));
const cpu=json('cpu.json').lscpu; const topology=json('topology.json').cpus;
if(!Array.isArray(cpu)||!Array.isArray(topology))throw Error('host output invalid');
if(hostname!==contract.fields.hostname.expectation)throw Error('hostname drift');
const rows=parseLscpuSummary({lscpu:cpu}), expect=contract.fields.cpuSummary.expectation;
if(rows.Architecture!==expect.architecture||Number(rows['CPU(s)'])!==expect.cpus||rows['On-line CPU(s) list']!==expect.online||rows['Vendor ID']!==expect.vendor||rows['Model name']!==expect.model||Number(rows['Thread(s) per core'])!==expect.threadsPerCore||Number(rows['Core(s) per socket'])!==expect.coresPerSocket||Number(rows['Socket(s)'])!==expect.sockets||rows['Virtualization type']!==expect.virtualization)throw Error('cpu drift');
const expectedTopology=contract.fields.cpuTopology.expectation; const actualTopology=topology.map((row)=>[Number(row.CPU),String(row.ONLINE).toLowerCase()==='yes',Number(row.SOCKET),Number(row.CORE),Number(row.NODE)]).sort((a,b)=>a[0]-b[0]); if(JSON.stringify(actualTopology)!==JSON.stringify(expectedTopology))throw Error('topology drift');
if(parseMemTotal(read('memory'))!==contract.fields.memory.expectationKb||one('kernel').replace(/[ \t]+/g,' ')!==contract.fields.kernel.expectation||one('timezone')!==contract.fields.timezone.expectation||one('cgroupfs')!==contract.fields.cgroupDocker.expectation.filesystem)throw Error('platform drift');
const os=parseOsRelease(read('os-release')); const oe=contract.fields.osRelease.expectation; if(os.ID!==oe.id||os.VERSION_ID!==oe.versionId||String(os.IMAGE_ID??'')!==oe.imageId||String(os.IMAGE_VERSION??'')!==oe.imageVersion||one('os-release.sha256')!==oe.sha256)throw Error('os drift');
const fsRow=json('rootfs.json').filesystems; const route=json('route.json'); const re=contract.fields.route.expectation,fe=contract.fields.rootFilesystem.expectation; if(!Array.isArray(fsRow)||fsRow.length!==1||fsRow[0].source!==fe.source||fsRow[0].fstype!==fe.fstype||fsRow[0].options.split(',').sort().join(',')!==fe.options||!Array.isArray(route)||route.length!==1||['dst','gateway','dev','prefsrc'].some((key)=>route[0][key]!==re[key]))throw Error('route drift');
const te=contract.fields.publicEgress.expectation,pe=contract.fields.egressProvider.expectation,rdap=json('rdap'); if(trace.ip!==te.ip||trace.tls!==te.tls||trace.warp!==te.warp||['name','country','startAddress','endAddress'].some((key)=>rdap[key]!==pe[key]))throw Error('egress drift');
const dns=parseDns({servers:read('dns.servers'),defaultRoute:read('dns.default-route'),status:read('dns.status')}),locale=parseLocale({status:read('locale.status'),charmap:read('locale.charmap')}),dnsExpected=contract.fields.dns.expectation; if(JSON.stringify(dns)!==JSON.stringify(dnsExpected)||JSON.stringify(locale)!==JSON.stringify(contract.fields.locale.expectation))throw Error('locale dns drift');
const cpuFreq=json('cpu-freq.json'); if(JSON.stringify(cpuFreq)!==JSON.stringify(contract.fields.cpuFreq.expectation))throw Error('cpu frequency drift');
const docker=json('docker-info.json'),de=contract.fields.cgroupDocker.expectation,be=contract.fields.hostBinaries.expectation,ie=contract.fields.iptables.expectation,ne=contract.fields.nft.expectation; if(Number(docker.CgroupVersion)!==de.version||docker.CgroupDriver!==de.driver||!one('dockerd').includes(`${be.dockerVersion} build ${be.dockerBuild}`)||one('dockerd.sha256')!==be.dockerSha256||!one('containerd').includes(`${be.containerdVersion} ${be.containerdBuild}`)||one('containerd.sha256')!==be.containerdSha256||one('iptables')!==ie.version||one('iptables.sha256')!==ie.sha256||one('iptables.path')!==ie.resolvedPath||one('iptables.link.stat')!==ie.linkOwnerMode||one('iptables.target.stat')!==ie.targetOwnerMode||one('iptables.target.sha256')!==ie.targetSha256||one('iptables-nft.path')!==ie.nftResolvedPath||one('iptables-nft.link.stat')!==ie.nftLinkOwnerMode||one('iptables-nft.target.stat')!==ie.nftTargetOwnerMode||one('iptables-nft.target.sha256')!==ie.nftTargetSha256||one('nft')!==ne.version||one('nft.sha256')!==ne.sha256)throw Error('binary drift');
const runnerRoot='/srv/baci-cwv/sealed/actions-runner';
const paths=contract.builderSources.host.runnerFiles;
const modes={'.runner':0o440,'bin/Runner.Listener':0o550,'bin/Runner.Worker':0o550,'entrypoint.mjs':0o440};
const files=paths.map((path)=>{const absolute=`${runnerRoot}/${path}`;const stat=fs.lstatSync(absolute);if(!stat.isFile()||stat.isSymbolicLink()||stat.uid!==0||stat.gid!==10001||stat.nlink!==1||(stat.mode&0o777)!==modes[path])throw Error('runner file ownership');return {path,sha256:createHash('sha256').update(fs.readFileSync(absolute)).digest('hex')}});
const canonicalJson=(value)=>JSON.stringify(value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map((key)=>[key,JSON.parse(canonicalJson(value[key]))])):Array.isArray(value)?value.map((entry)=>JSON.parse(canonicalJson(entry))):value);
const identityPath='/srv/baci-cwv/sealed/runner-identity.json',identityReceipt=validateSealedRunnerIdentity({bytes:fs.readFileSync(identityPath),details:fs.lstatSync(identityPath),identityContract:contract}),identity=identityReceipt.identity;
const hostIdentity={cgroupDocker:{driver:docker.CgroupDriver,filesystem:one('cgroupfs'),version:Number(docker.CgroupVersion)},controlCgroup:contract.fields.controlCgroup,cpuFreq:contract.fields.cpuFreq.expectation,cpuSummary:expect,cpuTopology:actualTopology,dns,egressProvider:pe,hostBinaries:be,hostname,ipForward:one('ip-forward'),iptables:{linkOwnerMode:one('iptables.link.stat'),nftLinkOwnerMode:one('iptables-nft.link.stat'),nftResolvedPath:one('iptables-nft.path'),nftTargetOwnerMode:one('iptables-nft.target.stat'),nftTargetSha256:one('iptables-nft.target.sha256'),resolvedPath:one('iptables.path'),sha256:one('iptables.sha256'),targetOwnerMode:one('iptables.target.stat'),targetSha256:one('iptables.target.sha256'),version:one('iptables')},kernel:one('kernel').replace(/[ \t]+/g,' '),locale,measurementCgroup:contract.fields.measurementCgroup,memory:parseMemTotal(read('memory')),nft:{sha256:one('nft.sha256'),version:one('nft')},osRelease:{id:os.ID,versionId:os.VERSION_ID,imageId:String(os.IMAGE_ID??''),imageVersion:String(os.IMAGE_VERSION??''),sha256:one('os-release.sha256')},publicEgress:trace,rootFilesystem:{source:fsRow[0].source,fstype:fsRow[0].fstype,options:fsRow[0].options.split(',').sort().join(',')},route:{dst:route[0].dst,gateway:route[0].gateway,dev:route[0].dev,prefsrc:route[0].prefsrc},timezone:one('timezone')};
if(canonicalJson(Object.keys(hostIdentity))!==canonicalJson(contract.builderSources.host.frozenFields))throw Error('host identity fields');
const hostRunner={files,runner:identity}; const payload={schemaVersion:1,hostname,hostIdentity,hostIdentityDigest:createHash('sha256').update(canonicalJson(hostIdentity)).digest('hex'),hostRunner,hostRunnerIdentityDigest:identityReceipt.sha256};
const canonical=canonicalJson(payload);
const envelope={canonical,owner:{uid:0,gid:10001,mode:'0640'},schemaVersion:1,sha256Receipt:`${createHash('sha256').update(canonical).digest('hex')}\n`,source:'host'};
process.stdout.write(`${canonicalJson(envelope)}\n`);
NODE
  trap - EXIT HUP INT TERM
  /bin/rm -rf -- "$temporary"
}
policy() { /usr/bin/node "$POLICY_TOOL" get "$1"; }
live_local() {
  campaign_id=$1; canonical_id "$campaign_id" || fail 'invalid campaign id'; assert_contract
  [ -d "$STATE_ROOT/$campaign_id" ] && [ ! -L "$STATE_ROOT/$campaign_id" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$STATE_ROOT/$campaign_id")" = 0:700 ] || fail 'campaign missing'
  [ "$(/bin/cat "$STATE_ROOT/$campaign_id/phase.json")" = '{"phase":"active"}' ] || fail 'campaign not active'
  for name in capture.json capture.sha256 watchdog-ready.json accounting-identity.json runtime-identity.json; do [ -f "$STATE_ROOT/$campaign_id/$name" ] && [ ! -L "$STATE_ROOT/$campaign_id/$name" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$STATE_ROOT/$campaign_id/$name")" = 0:600 ] || fail 'campaign local state missing'; done
  capture_sha=$(/bin/cat "$STATE_ROOT/$campaign_id/capture.sha256"); printf '%s' "$capture_sha" | /usr/bin/grep -Eq '^[a-f0-9]{64}$' || fail 'capture digest invalid'
  [ "$(hash "$STATE_ROOT/$campaign_id/capture.json")" = "$capture_sha" ] || fail 'capture digest mismatch'
  /usr/bin/jq -e --arg id "$campaign_id" '.schemaVersion == 1 and .transactionId == $id and .mode == "campaign"' "$STATE_ROOT/$campaign_id/capture.json" >/dev/null || fail 'capture binding failed'
  /usr/bin/jq -e --arg id "$campaign_id" --arg sha "$capture_sha" '.schemaVersion == 1 and .transactionId == $id and .captureSha256 == $sha and .lockHeld == true' "$STATE_ROOT/$campaign_id/watchdog-ready.json" >/dev/null || fail 'lease binding failed'
  /usr/bin/jq -e --arg id "$campaign_id" 'keys == ["campaignId","campaignMark","externalIfindex","externalInterface","generation","runnerContainerId","runnerIp","runnerPeerIfindex","runnerVeth"] and .campaignId == $id and .generation == 1 and (.runnerContainerId|test("^[a-f0-9]{64}$")) and (.runnerIp|test("^[0-9a-fA-F:.]+$")) and (.runnerVeth|test("^[A-Za-z0-9_.-]{1,15}$")) and (.externalInterface|test("^[A-Za-z0-9_.-]{1,15}$"))' "$STATE_ROOT/$campaign_id/runtime-identity.json" >/dev/null || fail 'runtime binding failed'
  [ "$(/bin/cat /proc/sys/net/ipv4/ip_forward)" = 1 ] || fail 'ip forwarding drift'
  table=$(policy /networkAccounting/table); family=$(policy /networkAccounting/family)
  [ "$table" = baci_cwv_measurement ] && [ "$family" = inet ] || fail 'accounting policy drift'
  capture "$STATE_ROOT/$campaign_id/live-nft.json" "$STATE_ROOT/$campaign_id/live-nft.err" /usr/sbin/nft --json --handle list table "$family" "$table"
  temporary=$(/usr/bin/mktemp -d /run/baci-cwv-host-attest.XXXXXX) || fail 'temporary unavailable'
  if ! control_evidence "$temporary" >"$STATE_ROOT/$campaign_id/live-cgroups.txt"; then
    /bin/rm -rf -- "$temporary"
    fail 'cgroup evidence failed'
  fi
  /bin/rm -rf -- "$temporary"
  runner_id=$(/usr/bin/jq -er .runnerContainerId "$STATE_ROOT/$campaign_id/runtime-identity.json")
  image_file=/srv/baci-cwv/image-id
  image_sha_file=/srv/baci-cwv/image-id.sha256
  [ -f "$image_file" ] && [ ! -L "$image_file" ] && [ "$(/usr/bin/stat -c '%u:%g:%a' -- "$image_file")" = 0:0:644 ] || fail 'runner image state missing'
  [ -f "$image_sha_file" ] && [ ! -L "$image_sha_file" ] && [ "$(/usr/bin/stat -c '%u:%g:%a' -- "$image_sha_file")" = 0:0:644 ] || fail 'runner image receipt missing'
  capture "$STATE_ROOT/$campaign_id/live-image-id" "$STATE_ROOT/$campaign_id/live-image-id.err" /bin/cat "$image_file"
  capture "$STATE_ROOT/$campaign_id/live-image-id.sha256" "$STATE_ROOT/$campaign_id/live-image-id.sha256.err" /bin/cat "$image_sha_file"
  capture "$STATE_ROOT/$campaign_id/live-runner.json" "$STATE_ROOT/$campaign_id/live-runner.err" /usr/bin/env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin LC_ALL=C.UTF-8 TZ=Etc/UTC HOME=/var/empty/baci-cwv /usr/bin/docker --host unix:///run/baci-cwv/docker.sock inspect --format '[{{json .Id}},{{json .Image}},{{json .State.Running}},{{json .State.Pid}},{{json .HostConfig.NetworkMode}},{{json .HostConfig.CgroupParent}},{{json .HostConfig.CpusetCpus}},{{json .HostConfig.Memory}},{{json .HostConfig.MemorySwap}},{{json .HostConfig.PidsLimit}},{{json .HostConfig.ShmSize}},{{json .HostConfig.ReadonlyRootfs}},{{json .HostConfig.Privileged}},{{json .HostConfig.CapAdd}},{{json .HostConfig.CapDrop}},{{json .HostConfig.SecurityOpt}},{{json .HostConfig.Binds}},{{json .Mounts}},{{json .HostConfig.Tmpfs}},{{json .NetworkSettings.Networks}}]' "$runner_id"
  runner_pid=$(/usr/bin/jq -er '.[3] | select(type == "number" and . > 1)' "$STATE_ROOT/$campaign_id/live-runner.json") || fail 'runner pid drift'
  capture "$STATE_ROOT/$campaign_id/live-cgroup" "$STATE_ROOT/$campaign_id/live-cgroup.err" /bin/cat "/proc/$runner_pid/cgroup"
  /usr/bin/node --input-type=module - "$campaign_id" "$STATE_ROOT/$campaign_id" "$table" "$(hash "$POLICY")" "$capture_sha" "$POLICY" <<'NODE'
import fs from 'node:fs'; import { createHash } from 'node:crypto';
const [id,root,table,policySha256,captureSha256,policyPath]=process.argv.slice(2);
const nft=fs.readFileSync(`${root}/live-nft.json`),cgroups=fs.readFileSync(`${root}/live-cgroups.txt`,'utf8'),runnerBytes=fs.readFileSync(`${root}/live-runner.json`),runner=JSON.parse(runnerBytes),accountingBytes=fs.readFileSync(`${root}/accounting-identity.json`),accounting=JSON.parse(accountingBytes),runtime=JSON.parse(fs.readFileSync(`${root}/runtime-identity.json`,'utf8')),capture=JSON.parse(fs.readFileSync(`${root}/capture.json`,'utf8')),policy=JSON.parse(fs.readFileSync(policyPath,'utf8'));
const canonical=(value)=>JSON.stringify(value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map((key)=>[key,JSON.parse(canonical(value[key]))])):Array.isArray(value)?value.map((entry)=>JSON.parse(canonical(entry))):value);
const one=(name)=>{const value=fs.readFileSync(`${root}/${name}`,'utf8');if(!value.endsWith('\n')||value.slice(0,-1).includes('\n'))throw Error('live host identity drift');return value.slice(0,-1)};
if(!Array.isArray(runner)||runner.length!==20)throw Error('live host identity drift'); const [runnerId,image,running,pid,networkMode,cgroupParent,,,,,,,,,,,,,,networks]=runner; const docker={id:runnerId,image,running,pid,networkMode,cgroupParent,networks};
if(!nft.length||!cgroups||capture.transactionId!==id||runtime.campaignId!==id||runtime.generation!==1||Object.keys(docker).sort().join(',')!=='cgroupParent,id,image,networkMode,networks,pid,running'||docker.id!==runtime.runnerContainerId)throw Error('local state invalid');
const imageAuthority=one('live-image-id'),imageReceipt=one('live-image-id.sha256'); if(!/^BACI_CWV_IMAGE_ID=sha256:[a-f0-9]{64}$/.test(imageAuthority)||!imageReceipt.match(/^[a-f0-9]{64}$/)||createHash('sha256').update(`${imageAuthority}\n`).digest('hex')!==imageReceipt)throw Error('runner image receipt drift'); const expectedImage=imageAuthority.slice('BACI_CWV_IMAGE_ID='.length); if(docker.running!==true||!Number.isSafeInteger(docker.pid)||docker.pid<2)throw Error('live host identity drift');
if(docker.image!==expectedImage)throw Error('runner image drift'); if(docker.networkMode!=='baci-cwv-net'||docker.cgroupParent!=='cwv-measurement.slice'||Object.keys(docker.networks).sort().join(',')!=='baci-cwv-net'||docker.networks['baci-cwv-net']?.IPAddress!==runtime.runnerIp)throw Error('runner network drift');
const cgroup=one('live-cgroup'); if(!cgroup.startsWith('0::/cwv-measurement.slice/')||!cgroup.includes(docker.id))throw Error('runner cgroup drift');
const entries=JSON.parse(nft).nftables; const comment=`${policy.dedicatedRuntime.ruleCommentPrefix}${id}:classify-measurement`; const classifiers=entries.filter((entry)=>entry.rule?.comment===comment).map((entry)=>entry.rule); if(classifiers.length!==1)throw Error('classifier drift');
const classifier=classifiers[0]; const classifierHandle=accounting.handles?.['classify-measurement']; const expressions=canonical(classifier.expr); if(!Number.isSafeInteger(classifier.handle)||classifier.handle<1||classifier.handle!==classifierHandle||classifier.chain!==policy.networkAccounting.classifyChain||classifier.family!==policy.networkAccounting.family||classifier.table!==table||!expressions.includes(`\"iifname\"`)||!expressions.includes(runtime.runnerVeth)||!expressions.includes(runtime.externalInterface)||!expressions.includes(String(runtime.campaignMark)))throw Error('classifier drift');
const liveIdentity={classifier:{handle:classifier.handle,sha256:createHash('sha256').update(canonical({chain:classifier.chain,expr:classifier.expr,handle:classifier.handle})).digest('hex')},container:{cgroup:cgroup.slice('0::'.length),expectedImage,expectedNetwork:'baci-cwv-net',id:docker.id,image:docker.image,networkMode:docker.networkMode,pid:docker.pid,running:docker.running},idleContainerSha256:createHash('sha256').update(runnerBytes).digest('hex'),nftSha256:createHash('sha256').update(nft).digest('hex')};
const value={schemaVersion:1,campaignId:id,captureSha256,policySha256,generation:runtime.generation,runnerContainerId:runtime.runnerContainerId,runnerIp:runtime.runnerIp,runnerVeth:runtime.runnerVeth,runnerPeerIfindex:runtime.runnerPeerIfindex,externalInterface:runtime.externalInterface,externalIfindex:runtime.externalIfindex,campaignMark:runtime.campaignMark,accountingTable:table,accountingIdentitySha256:createHash('sha256').update(accountingBytes).digest('hex'),nftSha256:liveIdentity.nftSha256,cgroupSha256:createHash('sha256').update(cgroups).digest('hex'),dockerSha256:createHash('sha256').update(canonical(docker)).digest('hex'),liveIdentity};
process.stdout.write(`${canonical(value)}\n`);
NODE
}

[ "$#" -ge 1 ] || usage
mode=$1; shift
case "$mode" in
  --identity-host) [ "$#" -eq 0 ] || usage; identity_host ;;
  --live-local) [ "$#" -eq 1 ] || usage; live_local "$1" ;;
  *) usage ;;
esac
