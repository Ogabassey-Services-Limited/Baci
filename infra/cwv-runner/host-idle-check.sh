#!/bin/sh
set -eu

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH LC_ALL=C.UTF-8 TZ=Etc/UTC
umask 077

SCRIPT_DIR=$(CDPATH='' cd -- "$(/usr/bin/dirname -- "$0")" && /bin/pwd -P)
readonly SCRIPT_DIR STATE_ROOT=/srv/baci-cwv/campaigns
readonly POLICY_TOOL="$SCRIPT_DIR/policy.schema.mjs" EVALUATOR="$SCRIPT_DIR/host-idle-evaluator.mjs"
readonly IMAGE_ID=/srv/baci-cwv/image-id IMAGE_RECEIPT=/srv/baci-cwv/image-receipt.json
readonly IMAGE_MAP=/srv/baci-cwv/receipts/image-process-map.json IMAGE_MAP_SHA=/srv/baci-cwv/receipts/image-process-map.sha256 IDENTITY_CONTRACT=/srv/baci-cwv/sealed/identity-contract.json
usage() { printf '%s\n' 'usage: host-idle-check.sh --live-local <campaign-id>|--rehearsal-local <campaign-id> <probe-container-id>' >&2; exit 64; }
refuse() { printf '{"accepted":false,"reason":"%s"}\n' "$1" >&2; exit 65; }
canonical_id() { printf '%s' "$1" | /usr/bin/grep -Eq '^[a-z0-9][a-z0-9-]{0,62}$'; }
regular() { [ -f "$1" ] && [ ! -L "$1" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$1")" = 0:600 ]; }
local_cmd() { /usr/bin/timeout --signal=TERM --kill-after=1s "$COMMAND_TIMEOUT" "$@"; }
policy() { /usr/bin/node "$POLICY_TOOL" get "$1"; }
monotonic() { local_cmd /usr/bin/node -e 'process.stdout.write(process.hrtime.bigint().toString()+String.fromCharCode(10))'; }
wait_for_bracket() {
  snapshot_end=$1 seconds=$2
  wait_timeout=$((seconds + 1))
  /usr/bin/timeout --signal=TERM --kill-after=1s "${wait_timeout}s" /usr/bin/node - "$snapshot_end" "$seconds" <<'NODE'
const [end, seconds] = process.argv.slice(2).map(BigInt);
const deadline = end + seconds * 1_000_000_000n;
const sleep = () => {
  const remaining = deadline - process.hrtime.bigint();
  if (remaining <= 0n) return;
  setTimeout(sleep, Math.max(1, Number(remaining / 1_000_000n)));
};
sleep();
NODE
}
readonly DOCKER_PROJECTION='[{{json .Id}},{{json .Image}},{{json .State.Running}},{{json .State.Pid}},{{json .HostConfig.NetworkMode}},{{json .HostConfig.CgroupParent}},{{json .HostConfig.CpusetCpus}},{{json .HostConfig.Memory}},{{json .HostConfig.MemorySwap}},{{json .HostConfig.PidsLimit}},{{json .HostConfig.ShmSize}},{{json .HostConfig.ReadonlyRootfs}},{{json .HostConfig.Privileged}},{{json .HostConfig.CapAdd}},{{json .HostConfig.CapDrop}},{{json .HostConfig.SecurityOpt}},{{json .HostConfig.Binds}},{{json .Mounts}},{{json .HostConfig.Tmpfs}},{{json .NetworkSettings.Networks}}]'
# Rehearsal requires the disposable probe contract: --network=none.

campaign_root() {
  campaign_id=$1 mode=$2; canonical_id "$campaign_id" || refuse invalid-campaign
  directory="$STATE_ROOT/$campaign_id"
  [ -d "$directory" ] && [ ! -L "$directory" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$directory")" = 0:700 ] || refuse campaign-state
  for name in capture.json capture.sha256 phase.json watchdog-ready.json; do regular "$directory/$name" || refuse campaign-state; done
  [ "$(/bin/cat "$directory/phase.json")" = '{"phase":"active"}' ] || refuse campaign-not-active
  capture_sha=$(/bin/cat "$directory/capture.sha256")
  printf '%s' "$capture_sha" | /usr/bin/grep -Eq '^[a-f0-9]{64}$' || refuse capture-digest
  [ "$(/usr/bin/sha256sum "$directory/capture.json" | /usr/bin/cut -d' ' -f1)" = "$capture_sha" ] || refuse capture-digest
  capture_mode=campaign; [ "$mode" = rehearsal ] && capture_mode=rehearsal
  /usr/bin/jq -e --arg campaign "$campaign_id" --arg mode "$capture_mode" '
    .transactionId == $campaign and .schemaVersion == 1 and .mode == $mode and
    (.host|type == "object")' "$directory/capture.json" >/dev/null || refuse capture-binding
  /usr/bin/jq -e --arg campaign "$campaign_id" --arg sha "$capture_sha" '
    .schemaVersion == 1 and .transactionId == $campaign and .captureSha256 == $sha and
    .lockHeld == true and (.watchdogPid|type == "number" and . > 1) and
    .lockOwnerPid == .watchdogPid' "$directory/watchdog-ready.json" >/dev/null || refuse lease-binding
  [ -d "/proc/$(/usr/bin/jq -er .watchdogPid "$directory/watchdog-ready.json")" ] || refuse lease-owner
}

processes() {
  local_cmd /usr/bin/node --input-type=module - "$IMAGE_MAP" <<'NODE'
import { createHash } from 'node:crypto'; import fs from 'node:fs';
const map = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const approved = new Set([...(map.entries ?? []), ...(map.sealed ?? [])].map(({ path }) => path));
const sensitive = new Set(['/opt/google/chrome/chrome', '/usr/bin/google-chrome-stable', '/opt/runner/bin/Runner.Listener', '/opt/runner/bin/Runner.Worker']);
const cached = new Map(), read = (path) => fs.readFileSync(path, 'utf8');
const processExited = (error) => error?.code === 'ENOENT' || error?.code === 'ESRCH';
const identity = (pid) => read(`/proc/${pid}/stat`);
const exitedOrChanged = (pid, before) => {
  try {
    const after = identity(pid);
    return before !== undefined && after !== before;
  } catch (error) {
    if (!processExited(error)) throw error;
    try {
      fs.statSync(`/proc/${pid}`);
      return false;
    } catch (directoryError) {
      if (!processExited(directoryError)) throw directoryError;
      return true;
    }
  }
};
const detail = (pid) => {
  if (cached.has(pid)) return cached.get(pid);
  const parent = /^\d+ \(.*\) . (\d+) /.exec(read(`/proc/${pid}/stat`))?.[1], executable = fs.realpathSync(`/proc/${pid}/exe`), cgroup = read(`/proc/${pid}/cgroup`).trim();
  if (!parent || !/^0::\/.+/.test(cgroup) || /[|\n]/.test(executable)) throw Error('invalid process identity');
  const path = cgroup.slice(3), cpuset = read(`/sys/fs/cgroup${path}/cpuset.cpus.effective`).trim();
  if (!/^[0-9,-]+$/.test(cpuset)) throw Error('invalid cgroup cpuset');
  const value = { parent, executable, cgroup: path, cpuset }; cached.set(pid, value); return value;
};
for (const name of fs.readdirSync('/proc').filter((value) => /^\d+$/.test(value)).sort((a, b) => Number(a) - Number(b))) {
  const pid = Number(name);
  let before;
  try {
    before = identity(pid);
    const value = detail(pid), parent = value.parent === '0' ? null : detail(Number(value.parent));
    const measured = approved.has(value.executable) || sensitive.has(value.executable) || ['/usr/bin/dockerd', '/usr/bin/containerd'].includes(value.executable);
    const parentMeasured = parent && (approved.has(parent.executable) || ['/usr/bin/dockerd', '/usr/bin/containerd'].includes(parent.executable));
    const digest = (target) => createHash('sha256').update(fs.readFileSync(`/proc/${target}/exe`)).digest('hex');
    process.stdout.write(`${pid}|${value.parent}|${value.executable}|${measured ? digest(pid) : '-'}|${value.cgroup}|${value.cpuset}|${parent?.executable ?? '-'}|${parentMeasured ? digest(value.parent) : '-'}\n`);
  } catch (error) {
    if (!processExited(error) || !exitedOrChanged(pid, before)) throw error;
  }
}
NODE
}

applications() {
  socket=$1 target=$2; : >"$target"
  ids=$(local_cmd /usr/bin/docker --host "$socket" ps --no-trunc --format '{{.ID}}') || return 1
  [ -z "$ids" ] && return 0
  set -f
  for id in $ids; do
    printf '%s' "$id" | /usr/bin/grep -Eq '^[a-f0-9]{64}$' || return 1
    local_cmd /usr/bin/docker --host "$socket" inspect --format '{{.Id}}|{{.State.Running}}|{{.HostConfig.CpusetCpus}}' "$id" >>"$target" || return 1
  done
  set +f
}

authority_input() {
  local_cmd /usr/bin/node --input-type=module - "$IMAGE_ID" "$IMAGE_RECEIPT" "$IMAGE_MAP" "$IMAGE_MAP_SHA" "$IDENTITY_CONTRACT" <<'NODE'
import { createHash } from 'node:crypto'; import fs from 'node:fs';
const [idPath, receiptPath, mapPath, mapDigestPath, contractPath] = process.argv.slice(2), sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const file = (path, mode) => { const stat = fs.lstatSync(path); if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== 0 || stat.gid !== 0 || (stat.mode & 0o777) !== mode) throw Error('authority file'); return fs.readFileSync(path); };
const id = file(idPath, 0o644), idReceipt = file(`${idPath}.sha256`, 0o644).toString('utf8'), match = /^BACI_CWV_IMAGE_ID=(sha256:[a-f0-9]{64})\n$/.exec(id);
const receipt = file(receiptPath, 0o600), receiptDigest = file(`${receiptPath.replace(/\.json$/, '.sha256')}`, 0o600).toString('utf8'), map = file(mapPath, 0o400), mapDigest = file(mapDigestPath, 0o400).toString('utf8'), contract = file(contractPath, 0o400);
const canonical = (value) => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
if (!match || idReceipt !== `${sha(id)}\n` || receiptDigest !== `${sha(receipt)}\n`) throw Error('image authority');
const image = JSON.parse(receipt), mapValue = JSON.parse(map), identity = JSON.parse(contract);
if (image.imageId !== match[1] || image.configDigest !== match[1] || mapDigest !== `${sha(map)}\n` || canonical(mapValue) !== map.toString('utf8') || canonical(image.processMap) !== map.toString('utf8')) throw Error('process map receipt');
process.stdout.write(`${JSON.stringify({ hostBinaries: identity.fields?.hostBinaries?.expectation, identityContractSha256: sha(contract), imageId: match[1], imageReceiptSha256: sha(receipt), processMap: mapValue, processMapSha256: sha(map), schemaVersion: 1 })}\n`);
NODE
}

snapshot() {
  target=$1 family=$2 table=$3 runner_id=${4:-} runner_veth=${5:-} external=${6:-} mode=${7:-}
  /bin/mkdir "$target" || return 1
  monotonic >"$target/monotonic" || return 1
  local_cmd /bin/cat /proc/stat >"$target/stat" || return 1
  local_cmd /usr/sbin/nft --json --handle list table "$family" "$table" >"$target/nft" || return 1
  monotonic >"$target/monotonic-end" || return 1
  local_cmd /bin/cat /proc/loadavg >"$target/loadavg" || return 1
  for resource in cpu io memory; do local_cmd /bin/cat "/proc/pressure/$resource" >"$target/$resource" || return 1; done
  local_cmd /usr/bin/grep '^MemAvailable:' /proc/meminfo >"$target/meminfo" || return 1
  local_cmd /usr/bin/stat -fc '%a %S' / >"$target/rootfs" || return 1
  local_cmd /bin/systemctl show cwv-measurement.slice --property=ActiveState,SubState,ControlGroup,CPUAccounting,MemoryAccounting,IOAccounting >"$target/cgroup" || return 1
  local_cmd /bin/cat /sys/fs/cgroup/cwv-measurement.slice/cgroup.events >"$target/cgroup.events" || return 1
  local_cmd /bin/cat /proc/sys/net/ipv4/ip_forward >"$target/ip_forward" || return 1
  processes >"$target/processes" || return 1
  applications unix:///run/baci-cwv/docker.sock "$target/applications" || return 1
  applications unix:///run/docker.sock "$target/production-applications" || return 1
  local_cmd /bin/cat /proc/net/nf_conntrack >"$target/conntrack" || return 1
  : >"$target/interfaces"
  for interface in "$runner_veth" "$external"; do
    [ -n "$interface" ] || continue
    ifindex=$(local_cmd /bin/cat "/sys/class/net/$interface/ifindex") || return 1
    iflink=$(local_cmd /bin/cat "/sys/class/net/$interface/iflink") || return 1
    printf '%s %s %s\n' "$interface" "$ifindex" "$iflink" >>"$target/interfaces" || return 1
  done
  [ -n "$runner_id" ] || return 1
  local_cmd /usr/bin/docker --host unix:///run/baci-cwv/docker.sock inspect --format "$DOCKER_PROJECTION" "$runner_id" >"$target/runner" || return 1
}

runtime_input() {
  mode=$1 campaign_id=$2 probe=$3 target=$4
  if [ "$mode" = live ]; then
    regular "$directory/runtime-identity.json" || refuse runtime-identity
    /usr/bin/jq -e --arg campaign "$campaign_id" '
      select(
      keys == ["campaignId","campaignMark","externalIfindex","externalInterface","generation","runnerContainerId","runnerIp","runnerPeerIfindex","runnerVeth"] and
      .campaignId == $campaign and .generation == 1 and (.campaignMark|type == "number") and
      (.runnerContainerId|test("^[a-f0-9]{64}$")) and (.runnerIp|test("^[0-9a-fA-F:.]+$")) and
      (.runnerVeth|test("^[A-Za-z0-9_.-]{1,15}$")) and (.externalInterface|test("^[A-Za-z0-9_.-]{1,15}$")) and
      (.runnerPeerIfindex|type == "number" and . > 0) and (.externalIfindex|type == "number" and . > 0)
      )' "$directory/runtime-identity.json" >"$target" || refuse runtime-identity
    runner_image=$(/usr/bin/sed -n 's/^BACI_CWV_IMAGE_ID=//p' "$IMAGE_ID") || refuse runner-image
    printf '%s' "$runner_image" | /usr/bin/grep -Eq '^sha256:[a-f0-9]{64}$' || refuse runner-image
    if ! /usr/bin/jq --arg image "$runner_image" --arg network 'baci-cwv-net' '. + {runnerImage:$image,runnerNetwork:$network}' "$target" >"$target.next" || ! /bin/mv "$target.next" "$target"; then
      refuse runtime-identity
    fi
  else
    printf '%s' "$probe" | /usr/bin/grep -Eq '^[a-f0-9]{64}$' || refuse invalid-probe
    probe_image=$(/usr/bin/sed -n 's/^BACI_CWV_IMAGE_ID=//p' "$IMAGE_ID") || refuse probe-image
    printf '%s' "$probe_image" | /usr/bin/grep -Eq '^sha256:[a-f0-9]{64}$' || refuse probe-image
    /usr/bin/jq -n --arg campaign "$campaign_id" --arg probe "$probe" --arg image "$probe_image" --argjson mark "$(/usr/bin/jq -er .campaignMark "$directory/accounting-base-identity.json")" '{campaignId:$campaign,generation:1,probeNetworkMode:"none",campaignMark:$mark,probeContainerId:$probe,probeImage:$image}' >"$target" || refuse rehearsal-runtime
  fi
}

run() {
  mode=$1 campaign_id=$2 probe=${3:-}
  [ -f "$SCRIPT_DIR/policy.json" ] && [ ! -L "$SCRIPT_DIR/policy.json" ] && [ -f "$POLICY_TOOL" ] && [ ! -L "$POLICY_TOOL" ] && [ -f "$EVALUATOR" ] && [ ! -L "$EVALUATOR" ] || refuse policy-state
  timeout_seconds=$(policy /dedicatedRuntime/registrationProbeTimeoutSeconds) || refuse timeout-policy
  printf '%s' "$timeout_seconds" | /usr/bin/grep -Eq '^[1-9][0-9]*$' || refuse timeout-policy
  COMMAND_TIMEOUT=${timeout_seconds}s
  campaign_root "$campaign_id" "$mode"
  identity=accounting-identity.json; [ "$mode" = live ] || identity=accounting-base-identity.json
  regular "$directory/$identity" || refuse accounting-identity
  family=$(policy /networkAccounting/family); table=$(policy /networkAccounting/table); comment_prefix=$(policy /dedicatedRuntime/ruleCommentPrefix)
  [ "$family:$table" = inet:baci_cwv_measurement ] || refuse accounting-policy
  [ "$comment_prefix" = 'baci-cwv:' ] || refuse accounting-policy
  temporary=$(/usr/bin/mktemp -d /run/baci-cwv-idle.XXXXXX) || refuse temporary
  trap 'rm -rf -- "$temporary"' EXIT HUP INT TERM
  runtime_input "$mode" "$campaign_id" "$probe" "$temporary/runtime.json"
  authority_input >"$temporary/process-authority.json" || refuse process-authority
  runner_id=$(/usr/bin/jq -er '.runnerContainerId // .probeContainerId' "$temporary/runtime.json")
  runner_veth=$(/usr/bin/jq -r '.runnerVeth // empty' "$temporary/runtime.json")
  external=$(/usr/bin/jq -r '.externalInterface // empty' "$temporary/runtime.json")
  [ -n "$external" ] || external=$(/usr/bin/jq -er .externalInterface "$directory/$identity")
  snapshot "$temporary/start" "$family" "$table" "$runner_id" "$runner_veth" "$external" "$mode" || refuse initial-snapshot
  seconds=$(policy /thresholds/networkSampleSeconds); [ "$seconds" = "$timeout_seconds" ] || refuse sample-policy
  start_end=$(/bin/cat "$temporary/start/monotonic-end") || refuse initial-snapshot
  wait_for_bracket "$start_end" "$seconds" || refuse sample-bracket
  snapshot "$temporary/end" "$family" "$table" "$runner_id" "$runner_veth" "$external" "$mode" || refuse final-snapshot
  policy /thresholds | /usr/bin/jq --argjson timeout "$timeout_seconds" '. + {commandTimeoutSeconds:$timeout}' >"$temporary/thresholds.json" || refuse thresholds
  policy /networkAccounting >"$temporary/network-accounting.json" || refuse accounting-policy
  policy /resources >"$temporary/resources.json" || refuse resource-policy
  policy_sha=$(/usr/bin/sha256sum "$SCRIPT_DIR/policy.json" | /usr/bin/cut -d' ' -f1) || refuse policy-digest
  accounting_sha=$(/usr/bin/sha256sum "$directory/$identity" | /usr/bin/cut -d' ' -f1) || refuse accounting-digest
  /usr/bin/jq -n --arg mode "$mode" --arg campaignId "$campaign_id" --arg family "$family" --arg table "$table" --arg ruleCommentPrefix "$comment_prefix" \
    --arg captureSha256 "$capture_sha" --arg policySha256 "$policy_sha" --arg accountingIdentitySha256 "$accounting_sha" --slurpfile identity "$directory/$identity" --slurpfile runtime "$temporary/runtime.json" --slurpfile thresholds "$temporary/thresholds.json" --slurpfile networkAccounting "$temporary/network-accounting.json" --slurpfile resources "$temporary/resources.json" --slurpfile processAuthority "$temporary/process-authority.json" \
    '{mode:$mode,campaignId:$campaignId,captureSha256:$captureSha256,policySha256:$policySha256,accountingIdentitySha256:$accountingIdentitySha256,family:$family,table:$table,ruleCommentPrefix:$ruleCommentPrefix,identity:$identity[0],runtime:($runtime[0]+{processAuthority:$processAuthority[0]}),thresholds:$thresholds[0],networkAccounting:$networkAccounting[0],resources:$resources[0]}' >"$temporary/input.json" || refuse evaluator-input
  /usr/bin/node "$EVALUATOR" evaluate "$temporary" "$temporary/input.json"
  trap - EXIT HUP INT TERM
  /bin/rm -rf -- "$temporary"
}

[ "$#" -ge 1 ] || usage
case "$1" in
  --live-local) [ "$#" -eq 2 ] || usage; run live "$2" ;;
  --rehearsal-local) [ "$#" -eq 3 ] || usage; run rehearsal "$2" "$3" ;;
  *) usage ;;
esac
