#!/bin/sh
set -eu
PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH LC_ALL=C.UTF-8 TZ=Etc/UTC
umask 077
ROOT=/srv/baci-cwv
RUN=/run/baci-cwv
SOURCE_ROOT=$ROOT/source
BOOTSTRAP_ROOT=/var/lib/baci-cwv/bootstrap
PREPARE_ROOT=/var/lib/baci-cwv/prepare
SCRIPT_DIR=$(CDPATH='' cd -- "$(/usr/bin/dirname -- "$0")" && /bin/pwd -P)
readonly ROOT RUN SOURCE_ROOT BOOTSTRAP_ROOT PREPARE_ROOT SCRIPT_DIR
die() { /usr/bin/printf '%s\n' "$1" >&2; exit 65; }
root_required() { [ "$(/usr/bin/id -u)" -eq 0 ] || die 'root required'; }
sha256() { /usr/bin/sha256sum -- "$1" | /usr/bin/awk '{print $1}'; }
is_sha() { /usr/bin/printf '%s' "$1" | /usr/bin/grep -Eq '^[a-f0-9]{64}$'; }
git_sha() { /usr/bin/printf '%s' "$1" | /usr/bin/grep -Eq '^[a-f0-9]{40}$'; }
regular() { [ -f "$1" ] && [ ! -L "$1" ]; }
root_mode() {
  identity=${2%:*}; owner=${identity%%:*}; group=${identity#*:}
  wanted=${2##*:}; wanted=${wanted#0}
  uid=$(/usr/bin/id -u -- "$owner") || return 1
  gid=$(/usr/bin/getent group "$group" | /usr/bin/awk -F: -v group="$group" '$1 == group && $3 ~ /^[0-9]+$/ { print $3; found = 1; exit } END { exit !found }') || return 1
  case "$uid:$gid" in :*|*:|*[!0-9:]*) return 1;; esac
  [ "$(/usr/bin/stat -c '%u:%g:%a' -- "$1")" = "$uid:$gid:$wanted" ]
}
policy() { /usr/bin/node "$SCRIPT_DIR/policy.schema.mjs" get "$1"; }
atomic_line() (
  destination=$1 value=$2 mode=$3 owner=$4 directory=${1%/*}; if [ "${BACI_CWV_BOOTSTRAP_REPLACEMENT-}" = 1 ] && regular "$BOOTSTRAP_DIRECTORY/replacement-intent.json" && { [ ! -e "$destination" ] || [ -L "$destination" ] || /usr/bin/jq -e --arg path "$destination" '.transitionPaths | index($path) != null' "$BOOTSTRAP_DIRECTORY/replacement-intent.json" >/dev/null; }; then /usr/bin/node "$SCRIPT_DIR/install-bootstrap-replacement-file.mjs" line "$BOOTSTRAP_DIRECTORY" "$destination" "$value" >/dev/null || die 'installed line drift'; return 0; fi
  if [ -e "$destination" ]; then
    regular "$destination" || die 'installed line drift'; if root_mode "$destination" "$owner:$mode" && [ "$(/bin/cat -- "$destination")" = "$value" ]; then return 0; fi
    if [ "${BACI_CWV_BOOTSTRAP_REPLACEMENT-}" = 1 ] && regular "$BOOTSTRAP_DIRECTORY/replacement-intent.json"; then /usr/bin/node "$SCRIPT_DIR/install-bootstrap-replacement-file.mjs" line "$BOOTSTRAP_DIRECTORY" "$destination" "$value" >/dev/null || die 'installed line drift'; return 0; fi
    root_mode "$destination" "$owner:$mode" || die 'installed line drift'; die 'replacement intent required'
  fi
  temporary=$(/usr/bin/mktemp "$directory/.tmp.XXXXXX") || die 'temporary file failed'
  trap '/bin/rm -f -- "$temporary"' EXIT HUP INT TERM
  /usr/bin/printf '%s\n' "$value" >"$temporary"
  /usr/bin/sync -f "$temporary" || die 'fsync failed'
  /bin/chown "$owner" "$temporary"; /bin/chmod "$mode" "$temporary"
  /bin/mv -f -- "$temporary" "$destination"; /usr/bin/sync -f "$directory" || die 'directory fsync failed'
  trap - EXIT HUP INT TERM
); ensure_directory() {
  directory=$1 mode=$2 owner=$3
  [ ! -L "$directory" ] || die 'symlink directory refused'
  /usr/bin/install -d -m "$mode" -o "${owner%:*}" -g "${owner#*:}" "$directory"
  root_mode "$directory" "${owner}:$mode" || die 'directory ownership or mode drift'
}; ensure_file() {
  source=$1 destination=$2 mode=$3 owner=${4:-root:root}
  case "$destination" in "$ROOT/sealed/"*token*|"$ROOT/sealed/"*credential*|"$ROOT/sealed/"*secret*) case "$owner:$mode" in root:root:0400|root:root:0500|root:root:0600) ;; *) die 'sealed credential must be root-only';; esac;; esac
  regular "$source" || die 'source file must be a regular nonsymlink'; if [ "${BACI_CWV_BOOTSTRAP_REPLACEMENT-}" = 1 ] && regular "$BOOTSTRAP_DIRECTORY/replacement-intent.json" && { [ ! -e "$destination" ] || [ -L "$destination" ] || /usr/bin/jq -e --arg path "$destination" '.transitionPaths | index($path) != null' "$BOOTSTRAP_DIRECTORY/replacement-intent.json" >/dev/null; }; then /usr/bin/node "$SCRIPT_DIR/install-bootstrap-replacement-file.mjs" source "$BOOTSTRAP_DIRECTORY" "$destination" "$source" >/dev/null || die 'installed file drift'; return 0; fi
  if [ -e "$destination" ]; then
    regular "$destination" || die 'installed file drift'; if root_mode "$destination" "$owner:$mode" && /usr/bin/cmp -s "$source" "$destination"; then return 0; fi
    if [ "${BACI_CWV_BOOTSTRAP_REPLACEMENT-}" = 1 ] && regular "$BOOTSTRAP_DIRECTORY/replacement-intent.json"; then /usr/bin/node "$SCRIPT_DIR/install-bootstrap-replacement-file.mjs" source "$BOOTSTRAP_DIRECTORY" "$destination" "$source" >/dev/null || die 'installed file drift'; return 0; fi
    root_mode "$destination" "$owner:$mode" || die 'installed file drift'; die 'replacement intent required'
  fi
  temporary=$(/usr/bin/mktemp "${destination%/*}/.tmp.XXXXXX") || die 'temporary file failed'
  /bin/cp -- "$source" "$temporary"; /usr/bin/sync -f "$temporary" || die 'fsync failed'
  /bin/chown "$owner" "$temporary"; /bin/chmod "$mode" "$temporary"
  /bin/mv -f -- "$temporary" "$destination"; /usr/bin/sync -f "${destination%/*}" || die 'directory fsync failed'
  if [ -n "${BOOTSTRAP_DIRECTORY-}" ]; then
    /usr/bin/node "$SCRIPT_DIR/install-bootstrap-controller.mjs" journal "$BOOTSTRAP_DIRECTORY" install-file "$destination" "$(sha256 "$destination")"
  fi
}
assert_sealed_source() {
  source_sha=$1 manifest=$2 digest_file=$3
  git_sha "$source_sha" || die 'invalid source sha'
  case "$SCRIPT_DIR" in "$SOURCE_ROOT/$source_sha") ;; *) die 'installer must run from sealed exact source';; esac
  expected_receipts="$ROOT/source-receipts/$source_sha"
  [ "$manifest" = "$expected_receipts/manifest.json" ] && [ "$digest_file" = "$expected_receipts/manifest.sha256" ] || die 'canonical source receipt paths required'
  if ! regular "$manifest" || ! root_mode "$manifest" 'root:root:600'; then die 'sealed manifest required'; fi
  if ! regular "$digest_file" || ! root_mode "$digest_file" 'root:root:600'; then die 'sealed digest required'; fi
  [ "$(/usr/bin/wc -l <"$digest_file" | /usr/bin/tr -d ' ')" = 1 ] || die 'invalid source manifest digest'
  manifest_sha=$(/bin/cat -- "$digest_file"); is_sha "$manifest_sha" || die 'invalid source manifest digest'
  [ "$(sha256 "$manifest")" = "$manifest_sha" ] || die 'source manifest digest mismatch'
  seal_receipt="$expected_receipts/seal-receipt.json"; regular "$seal_receipt" || die 'seal receipt required'
  /usr/bin/jq -e --arg source "$source_sha" --arg manifest "$manifest_sha" '
    keys == ["archiveSha256","manifestSha256","schemaVersion","sealedTreeSha256","sourceSha"] and
    .schemaVersion == 1 and .sourceSha == $source and .manifestSha256 == $manifest and
    (.archiveSha256|test("^[a-f0-9]{64}$")) and (.sealedTreeSha256|test("^[a-f0-9]{64}$"))' "$seal_receipt" >/dev/null || die 'seal receipt mismatch'
  /usr/bin/jq -e --arg source "$source_sha" '.schemaVersion == 1 and .mergeSha == $source' "$manifest" >/dev/null || die 'manifest merge identity mismatch'
  regular "$SCRIPT_DIR/policy.json" || die 'sealed policy required'
  policy_sha=$(sha256 "$SCRIPT_DIR/policy.json")
  /usr/bin/jq -e --arg sha "$policy_sha" '.sourceArchive.entries[]? | select(.path == "infra/cwv-runner/policy.json" and .blobSha256 == $sha)' "$manifest" >/dev/null || die 'sealed policy is not manifest-bound'
}; assert_containerd_compatible() { regular "$SCRIPT_DIR/identity-contract.json" || die 'identity contract required'; expected=$(/usr/bin/jq -er '.fields.hostBinaries.expectation.containerdVersion' "$SCRIPT_DIR/identity-contract.json") || die 'containerd version contract refused'; /usr/bin/printf '%s' "$expected" | /usr/bin/grep -Eq '^2\.[0-9]+\.[0-9]+$' || die 'containerd version contract refused'; version=$(/usr/bin/containerd --version 2>/dev/null | /usr/bin/awk 'NR == 1 { for (i = 1; i <= NF; i += 1) if ($i ~ /^v[0-9]+\.[0-9]+\.[0-9]+$/) { print substr($i, 2); found = 1; exit } } END { exit !found }') || die 'containerd version refused'; [ "$version" = "$expected" ] || die 'containerd version refused'; }
install_account() {
  user=$(policy /host/runnerAccount) || die 'runner account policy refused'
  uid=$(policy /host/runnerUid) || die 'runner uid policy refused'
  gid=$(policy /host/runnerGid) || die 'runner gid policy refused'
  exec_account="$SCRIPT_DIR/install-account-identity.sh"; regular "$exec_account" || die 'runner identity verifier required'; /bin/sh "$exec_account" "$user" "$uid" "$gid"
}
install_layout() {
  ensure_directory "$ROOT" 0750 root:root; ensure_directory "$ROOT/sealed" 0750 root:baci-cwv; ensure_directory "$ROOT/writable" 0750 root:baci-cwv
  for directory in source source-receipts docker containerd registration-staging campaigns retired-ollama import dedicated-runtime receipts; do ensure_directory "$ROOT/$directory" 0700 root:root; done; ensure_directory "$ROOT/allow" 0750 root:baci-cwv
  for directory in _diag _work scratch; do ensure_directory "$ROOT/writable/$directory" 0700 baci-cwv:baci-cwv; done
  ensure_directory "$ROOT/hooks" 0755 root:root; ensure_directory "$ROOT/listener-release" 0750 root:baci-cwv
  ensure_directory "$ROOT/evidence" 0750 root:baci-cwv; ensure_directory "$ROOT/live-sample" 0750 root:baci-cwv
  ensure_directory "$ROOT/sealed/actions-runner" 0750 root:baci-cwv
  ensure_directory "$RUN" 0750 root:baci-cwv; ensure_directory "$RUN/containerd" 0750 root:root
  ensure_directory "$RUN/docker-exec" 0750 root:root; ensure_directory /etc/baci-cwv 0755 root:root
  ensure_directory /var/lib/baci-cwv 0700 root:root; ensure_directory "$BOOTSTRAP_ROOT" 0700 root:root; ensure_directory "$PREPARE_ROOT" 0700 root:root
}
render_watchdog() {
  source_sha=$1 source=$SCRIPT_DIR/baci-cwv-campaign-watchdog@.service target=/etc/systemd/system/baci-cwv-campaign-watchdog@.service
  regular "$source" || die 'watchdog source missing'
  [ "$(/usr/bin/grep -o '@BACI_CWV_SOURCE_SHA@' "$source" | /usr/bin/wc -l | /usr/bin/tr -d ' ')" = 1 ] || die 'invalid watchdog token count'
  rendered_sha=$(/usr/bin/sed "s/@BACI_CWV_SOURCE_SHA@/$source_sha/g" "$source" | /usr/bin/sha256sum | /usr/bin/awk '{print $1}'); destination_sha=$(/usr/bin/printf '%s' "$target" | /usr/bin/sha256sum | /usr/bin/awk '{print $1}'); if ! is_sha "$rendered_sha" || ! is_sha "$destination_sha"; then die 'watchdog render authority refused'; fi; bound_watchdog=; residue_patterns='/etc/systemd/system/.baci-cwv-watchdog.??????'; if [ "${BACI_CWV_BOOTSTRAP_REPLACEMENT-}" = 1 ] && regular "$BOOTSTRAP_DIRECTORY/replacement-intent.json" && /usr/bin/jq -e --arg path "$target" '.transitionPaths | index($path) != null' "$BOOTSTRAP_DIRECTORY/replacement-intent.json" >/dev/null; then bound_watchdog=1; residue_patterns=; /usr/bin/node "$SCRIPT_DIR/install-bootstrap-watchdog-residue.mjs" "$BOOTSTRAP_DIRECTORY" "$target" "$SOURCE_ROOT" || die 'watchdog render temporary drift'; fi
  residue_removed=; for residue in $residue_patterns; do [ -e "$residue" ] || [ -L "$residue" ] || continue; regular "$residue" || die 'watchdog render temporary drift'; links=$(/usr/bin/stat -c %h -- "$residue") || die 'watchdog render temporary drift'; case "$links" in 1) { root_mode "$residue" root:root:0600 || root_mode "$residue" root:root:0644; } || die 'watchdog render temporary drift'; residue_size=$(/usr/bin/stat -c %s -- "$residue") || die 'watchdog render temporary drift'; case "$residue_size" in *[!0-9]*|'') die 'watchdog render temporary drift';; esac; if [ "$residue_size" -le 1048576 ] && /usr/bin/sed "s/@BACI_CWV_SOURCE_SHA@/$source_sha/g" "$source" | /usr/bin/head -c "$residue_size" | /usr/bin/cmp -s "$residue" -; then :; else die 'watchdog render temporary drift'; fi;; 2) if root_mode "$residue" root:root:0644 && regular "$target" && root_mode "$target" root:root:0644 && [ "$residue" -ef "$target" ] && /usr/bin/sed "s/@BACI_CWV_SOURCE_SHA@/$source_sha/g" "$source" | /usr/bin/cmp -s "$residue" -; then :; else die 'watchdog render temporary drift'; fi;; *) die 'watchdog render temporary drift';; esac; /bin/rm -- "$residue" || die 'watchdog render temporary cleanup failed'; residue_removed=1; done; if [ "$residue_removed" = 1 ]; then /usr/bin/sync -f /etc/systemd/system || die 'watchdog render temporary fsync failed'; fi; if [ "$bound_watchdog" = 1 ]; then temporary=$(/usr/bin/mktemp "/etc/systemd/system/.baci-cwv-watchdog-v1-${destination_sha}-${rendered_sha}-XXXXXX") || die 'temporary render failed'; else temporary=$(/usr/bin/mktemp /etc/systemd/system/.baci-cwv-watchdog.XXXXXX) || die 'temporary render failed'; fi
  /bin/chown root:root "$temporary"; /usr/bin/sed "s/@BACI_CWV_SOURCE_SHA@/$source_sha/g" "$source" >"$temporary"
  /usr/bin/grep -Fq '@BACI_CWV_SOURCE_SHA@' "$temporary" && die 'unrendered watchdog token'; if [ "$(sha256 "$temporary")" != "$rendered_sha" ]; then /bin/rm -f -- "$temporary"; die 'watchdog render authority refused'; fi; /bin/chmod 0644 "$temporary"
  reconciled=; if [ "${BACI_CWV_BOOTSTRAP_REPLACEMENT-}" = 1 ] && regular "$BOOTSTRAP_DIRECTORY/replacement-intent.json" && /usr/bin/jq -e --arg path "$target" '.transitionPaths | index($path) != null' "$BOOTSTRAP_DIRECTORY/replacement-intent.json" >/dev/null; then /usr/bin/node "$SCRIPT_DIR/install-bootstrap-replacement-file.mjs" source "$BOOTSTRAP_DIRECTORY" "$target" "$temporary" >/dev/null || { /bin/rm -f -- "$temporary"; die 'watchdog unit drift'; }; /bin/rm -f -- "$temporary"; reconciled=1; fi
  if [ "$reconciled" = 1 ]; then :; elif [ -e "$target" ] || [ -L "$target" ]; then
    if ! regular "$target" || ! root_mode "$target" root:root:0644; then die 'watchdog unit drift'; fi
    if /usr/bin/cmp -s "$temporary" "$target"; then /bin/rm -f -- "$temporary"; elif [ "${BACI_CWV_BOOTSTRAP_REPLACEMENT-}" = 1 ] && regular "$BOOTSTRAP_DIRECTORY/replacement-intent.json"; then /usr/bin/node "$SCRIPT_DIR/install-bootstrap-replacement-file.mjs" source "$BOOTSTRAP_DIRECTORY" "$target" "$temporary" >/dev/null || { /bin/rm -f -- "$temporary"; die 'watchdog unit drift'; }; /bin/rm -f -- "$temporary"; else /bin/rm -f -- "$temporary"; die 'watchdog unit drift'; fi; elif [ "${BACI_CWV_BOOTSTRAP_REPLACEMENT-}" = 1 ] && regular "$BOOTSTRAP_DIRECTORY/replacement-intent.json"; then /usr/bin/node "$SCRIPT_DIR/install-bootstrap-replacement-file.mjs" source "$BOOTSTRAP_DIRECTORY" "$target" "$temporary" >/dev/null || { /bin/rm -f -- "$temporary"; die 'watchdog unit drift'; }; /bin/rm -f -- "$temporary"
  else /bin/ln -- "$temporary" "$target" || die 'watchdog unit install refused'; /bin/rm -f -- "$temporary"; fi
  /usr/bin/sync -f /etc/systemd/system || die 'watchdog directory fsync failed'
  /usr/bin/node "$SCRIPT_DIR/install-bootstrap-controller.mjs" journal "$BOOTSTRAP_DIRECTORY" render-watchdog "$target" "$(sha256 "$target")"
}
install_units() {
  for name in baci-cwv-containerd.service baci-cwv-docker.service baci-cwv-measurement.service baci-cwv-host-sampler.service baci-cwv-host-sampler.timer cwv-measurement-control.slice cwv-measurement.slice; do
    ensure_file "$SCRIPT_DIR/$name" "/etc/systemd/system/$name" 0644
  done
  ensure_file "$SCRIPT_DIR/containerd.toml" /etc/baci-cwv/containerd.toml 0644
  ensure_file "$SCRIPT_DIR/daemon.json" /etc/baci-cwv/daemon.json 0644
  /bin/systemctl daemon-reload
  UNIT_STATES=$(/usr/bin/jq -cn '{}'); for name in baci-cwv-containerd.service baci-cwv-docker.service baci-cwv-measurement.service baci-cwv-host-sampler.service baci-cwv-host-sampler.timer; do
    /bin/systemctl disable --now "$name"; state=$(/bin/systemctl show "$name" --property=LoadState --property=ActiveState --property=UnitFileState --value --no-pager); [ "$state" = "$(/usr/bin/printf 'loaded\ninactive\nstatic')" ] || die 'unit did not become inactive with the expected file state'; UNIT_STATES=$(printf '%s' "$UNIT_STATES" | /usr/bin/jq -c --arg name "$name" --arg state "$state" '. + {($name):($state + "\n")}'); /usr/bin/node "$SCRIPT_DIR/install-bootstrap-controller.mjs" journal "$BOOTSTRAP_DIRECTORY" disable-unit "/etc/systemd/system/$name" "$(sha256 "/etc/systemd/system/$name")"
  done; template='baci-cwv-campaign-watchdog@.service'; runtime_instances=$(/bin/systemctl list-units 'baci-cwv-campaign-watchdog@*.service' --all --plain --no-legend --full --no-pager) || die 'watchdog instance inventory refused'; file_instances=$(/bin/systemctl list-unit-files 'baci-cwv-campaign-watchdog@*.service' --no-legend --full --no-pager) || die 'watchdog instance inventory refused'; persistent_links=$(/usr/bin/find /etc/systemd/system -mindepth 2 -maxdepth 2 -type l -path '/etc/systemd/system/*.wants/baci-cwv-campaign-watchdog@*.service' -print) || die 'watchdog instance inventory refused'; runtime_links=$(/usr/bin/find /run/systemd/system -mindepth 2 -maxdepth 2 -type l -path '/run/systemd/system/*.wants/baci-cwv-campaign-watchdog@*.service' -print) || die 'watchdog instance inventory refused'; enabled_links=$(/usr/bin/printf '%s\n%s\n' "$persistent_links" "$runtime_links") || die 'watchdog instance inventory refused'; template_target=$(/usr/bin/readlink -f -- "/etc/systemd/system/$template") || die 'watchdog instance inventory refused'; enabled_instances=''; runtime_enabled_instances=''; for link in $enabled_links; do case "$link" in /etc/systemd/system/*.wants/baci-cwv-campaign-watchdog@*.service) ;; /run/systemd/system/*.wants/baci-cwv-campaign-watchdog@*.service) runtime_enabled_instances="$runtime_enabled_instances ${link##*/}";; *) die 'watchdog instance inventory refused';; esac; [ -L "$link" ] || die 'watchdog instance inventory refused'; resolved=$(/usr/bin/readlink -f -- "$link") || die 'watchdog instance inventory refused'; [ "$resolved" = "$template_target" ] || die 'watchdog instance inventory refused'; enabled_instances=$(/usr/bin/printf '%s\n%s' "$enabled_instances" "${link##*/}") || die 'watchdog instance inventory refused'; done; instances=$(/usr/bin/printf '%s\n%s\n%s\n' "$runtime_instances" "$file_instances" "$enabled_instances" | /usr/bin/awk 'NF == 0 { next } $1 == "●" { if (NF < 2 || $2 !~ /^baci-cwv-campaign-watchdog@[^[:space:]]+\.service$/) exit 1; print $2; next } { if ($1 !~ /^baci-cwv-campaign-watchdog@([^[:space:]]+)?\.service$/) exit 1; print $1 }') || die 'watchdog instance inventory refused'; instances=$(/usr/bin/printf '%s\n' "$instances" | /usr/bin/sort -u) || die 'watchdog instance inventory refused'; for name in $instances; do [ "$name" != "$template" ] || continue; case "$name" in baci-cwv-campaign-watchdog@*.service) ;; *) die 'watchdog instance inventory refused';; esac; /bin/systemctl disable --now "$name" || die 'watchdog instance disable refused'; case " $runtime_enabled_instances " in *" $name "*) /bin/systemctl disable --runtime "$name" || die 'watchdog runtime instance disable refused';; esac; /bin/systemctl reset-failed "$name" || die 'watchdog failed-state reset refused'; state=$(/bin/systemctl show "$name" --property=LoadState --property=ActiveState --property=UnitFileState --value --no-pager); [ "$state" = "$(/usr/bin/printf 'loaded\ninactive\ndisabled')" ] || die 'watchdog instance did not become disabled'; done
  if template_state=$(/bin/systemctl is-enabled "$template" 2>/dev/null); then die 'watchdog template remained enabled'; else [ "$?" -eq 1 ] && [ "$template_state" = disabled ] || die 'watchdog template state refused'; fi; state=$(/usr/bin/printf 'loaded\ninactive\ndisabled'); UNIT_STATES=$(printf '%s' "$UNIT_STATES" | /usr/bin/jq -c --arg name "$template" --arg state "$state" '. + {($name):($state + "\n")}'); /usr/bin/node "$SCRIPT_DIR/install-bootstrap-controller.mjs" journal "$BOOTSTRAP_DIRECTORY" disable-unit "/etc/systemd/system/$template" "$(sha256 "/etc/systemd/system/$template")"
}
install_sealed_helpers() {
  ensure_file "$SCRIPT_DIR/policy.json" "$ROOT/sealed/policy.json" 0400 root:root
  for name in policy.schema.mjs archive-link-validation.mjs archive-index.mjs archive-stream.mjs build-image.mjs canonical-json.mjs command-settings-contract.mjs image-archive-authority.mjs image-process-map.mjs image-projection-config.mjs image-projection.mjs rootfs-projection-contract.mjs rootfs-source-membership.mjs rootfs-source-membership-input.mjs rootfs-source-inventory.mjs source-tree-projection.mjs runner-runtime-archive-snapshot.mjs runner-runtime-identity-manifest.mjs runner-runtime-manifest-producer-cli.mjs runner-runtime-manifest-producer.mjs runner-runtime-output-paths.mjs runner-runtime-manifest-receipt-reader.mjs runner-runtime-receipt-contract.mjs campaign-state.mjs campaign-state-collisions.mjs campaign-state-journal-lock.mjs campaign-capture-authority.mjs campaign-traffic.mjs campaign-terminal-cleanup.mjs campaign-lease-holder.sh campaign-quiesce.sh campaign-restore.sh campaign-restore-post-commit.sh campaign-restore-terminal-receipt.sh campaign-restore-network.mjs campaign-restore-baseline.mjs campaign-network-contract.mjs campaign-accounting-contract.mjs campaign-ownership.mjs campaign-cron-tree.mjs campaign-source-closure.mjs campaign-watchdog.sh host-idle-check.sh host-idle-evaluator.mjs host-idle-network.mjs host-idle-process-authority.mjs host-idle-snapshot.mjs host-idle-validation.mjs host-attest.sh host-attestation-normalize.mjs host-attestation.mjs attestation-evidence-store.mjs host-control-evidence.mjs host-sample-publisher.mjs install-bootstrap.mjs install-bootstrap-atomic-state-file.mjs install-bootstrap-capture-persistence.mjs install-bootstrap-installed.mjs install-bootstrap-journal.mjs install-bootstrap-plan-publication.mjs install-bootstrap-watchdog-residue.mjs install-bootstrap-rename-exchange.pl install-account-identity.sh install-prepare-acceptance.mjs install-prepare-store.mjs install-prepare-content-cleanup.mjs install-prepare-content-cleanup-cli.mjs install-prepare-content-safety.mjs install-prepare-synthetic.mjs install-prepare-runtime-receipt.mjs measurement-container-projection.mjs measurement-service-wrapper.sh registration-terminal-receipt.mjs registration-terminal-evidence.mjs registration-terminal-lease-recovery.mjs registration-command-prepare.mjs registration-command-retry-block.mjs registration-command-store.mjs registration-retry-block.mjs registration-runtime-contract.mjs registration-controller-cleanup.mjs registration-controller-flow.mjs registration-controller-normal-mode.mjs registration-controller-state.mjs registration-controller.mjs registration-root-contract.mjs registration-root-configuration.mjs registration-root-docker.mjs registration-root-filesystem.mjs registration-root-inspection.mjs registration-network-cleanup.mjs registration-network-policy.mjs registration-network-probes.mjs registration-post-egress-recovery.mjs registration-root-network.mjs registration-root-authority.mjs registration-root-guard.mjs registration-root-guard-operations.mjs registration-root-mount-namespace.mjs registration-root-observer.mjs registration-root-observer-live.mjs registration-root-operations.mjs registration-root-request-stream.mjs registration-token-fd.mjs registration-token-mount.mjs registration-root-receipts.mjs registration-root-recovery-classifier.mjs registration-root-restoration.mjs registration-root-sealing.mjs runner-identity-contract.mjs runner-runtime-projection.mjs registration-root-system.mjs registration-root-terminal-cleanup.mjs root-registration-backend-client.mjs root-registration-operation-adapter.mjs root-runtime-executor.mjs root-runtime-owned-read.mjs root-runtime-registration-adapter.mjs root-runtime-post-egress-recovery.mjs root-runtime-operations.mjs runtime-probe-controller.mjs exact-run-accounting.mjs exact-run-contract-cli.mjs exact-run-contract.mjs normal-release.mjs exact-run-controller.sh exact-run-live-sample-contract.mjs exact-run-process-contract.mjs exact-run-rearm-contract.mjs exact-run-terminal-cleanup.sh exact-run-transition-contract.mjs; do
    ensure_file "$SCRIPT_DIR/$name" "$ROOT/sealed/$name" 0500
  done
  ensure_file "$SCRIPT_DIR/root-runtime-installed-receipt.mjs" "$ROOT/sealed/root-runtime-installed-receipt.mjs" 0500; ensure_file "$SCRIPT_DIR/registration-authority-parent-sync.mjs" "$ROOT/sealed/registration-authority-parent-sync.mjs" 0500; for name in cron-inventory.json identity-contract.json; do ensure_file "$SCRIPT_DIR/$name" "$ROOT/sealed/$name" 0400; done
  ensure_file "$SCRIPT_DIR/job-start-hook.sh" "$ROOT/hooks/job-start-hook.sh" 0550 root:baci-cwv
}
bootstrap() {
  [ "$#" -eq 6 ] || die 'usage: --bootstrap-control --source-sha <sha> --source-manifest <path> --source-manifest-sha256 <path>'
  [ "$1" = --source-sha ] && [ "$3" = --source-manifest ] && [ "$5" = --source-manifest-sha256 ] || die 'invalid bootstrap arguments'
  assert_sealed_source "$2" "$4" "$6"
  assert_containerd_compatible; exec 8>/run/lock/baci-cwv-campaign.lock; /usr/bin/flock -n 8 || die 'campaign lock refused during bootstrap'; ensure_directory /var/lib/baci-cwv 0700 root:root; ensure_directory "$BOOTSTRAP_ROOT" 0700 root:root
  transaction="bootstrap-$(/usr/bin/printf '%s' "$2" | /usr/bin/cut -c1-12)"; BOOTSTRAP_DIRECTORY="$BOOTSTRAP_ROOT/$transaction"; export BOOTSTRAP_DIRECTORY
  policy_file_sha=$(sha256 "$SCRIPT_DIR/policy.json")
  plan=$(/usr/bin/node "$SCRIPT_DIR/install-bootstrap-plan.mjs" "$SCRIPT_DIR" "$2" "$(/bin/cat "$6")" "$policy_file_sha" "$(sha256 "$SCRIPT_DIR/install.sh")" "$transaction" | /usr/bin/node "$SCRIPT_DIR/install-bootstrap-plan-publication.mjs" "$BOOTSTRAP_ROOT/..") || die 'bootstrap plan failed'
  trap '/bin/rm -f -- "$plan"' EXIT HUP INT TERM
  /usr/bin/node "$SCRIPT_DIR/install-bootstrap-controller.mjs" begin "$BOOTSTRAP_ROOT" "$plan" >/dev/null || die 'bootstrap capture failed'
  phase=$(/usr/bin/node "$SCRIPT_DIR/install-bootstrap-controller.mjs" resume "$BOOTSTRAP_DIRECTORY" "$plan")
  if [ "$phase" = complete ]; then /usr/bin/node "$SCRIPT_DIR/install-bootstrap-controller.mjs" verify "$BOOTSTRAP_DIRECTORY" "$plan" >/dev/null; /usr/bin/node "$SCRIPT_DIR/install-bootstrap-controller.mjs" replacement-inventory "$BOOTSTRAP_ROOT" >/dev/null || die 'bootstrap plan reconciliation refused'; if [ -e "$BOOTSTRAP_DIRECTORY/replacement-intent.json" ] || [ -L "$BOOTSTRAP_DIRECTORY/replacement-intent.json" ] || [ -e "$BOOTSTRAP_DIRECTORY/replacement-receipt.json" ] || [ -L "$BOOTSTRAP_DIRECTORY/replacement-receipt.json" ]; then /usr/bin/node "$SCRIPT_DIR/install-bootstrap-controller.mjs" replacement-complete "$BOOTSTRAP_DIRECTORY" || die 'bootstrap replacement completion refused'; fi; trap - EXIT HUP INT TERM; /bin/rm -f -- "$plan"; return 0; fi
  replacement=$(/usr/bin/node "$SCRIPT_DIR/install-bootstrap-controller.mjs" replacement-authorize "$BOOTSTRAP_DIRECTORY" "$BOOTSTRAP_ROOT" "$ROOT" "$PREPARE_ROOT") || die 'bootstrap replacement refused'
  if [ "$replacement" != none ]; then BACI_CWV_BOOTSTRAP_REPLACEMENT=1; export BACI_CWV_BOOTSTRAP_REPLACEMENT; fi
  if [ "$replacement" = none ] && /usr/bin/jq -e '(.prior | type == "object") and (.files | type == "object") and (.prior == .files)' "$BOOTSTRAP_DIRECTORY/capture.json" >/dev/null; then die 'provisioned identical bootstrap projection requires replacement plan'; fi
  install_account; install_layout; install_sealed_helpers; render_watchdog "$2"; install_units
  atomic_line "$ROOT/sealed/policy.sha256" "$policy_file_sha" 0640 root:baci-cwv
  atomic_line "$ROOT/sealed/bootstrap.sha256" "$(sha256 "$SCRIPT_DIR/install.sh")" 0600 root:root
  atomic_line "$ROOT/sealed/source-manifest.sha256" "$(/bin/cat "$6")" 0600 root:root
  for path in "$ROOT/sealed/policy.sha256" "$ROOT/sealed/bootstrap.sha256" "$ROOT/sealed/source-manifest.sha256"; do /usr/bin/node "$SCRIPT_DIR/install-bootstrap-controller.mjs" journal "$BOOTSTRAP_DIRECTORY" install-file "$path" "$(sha256 "$path")"; done
  /usr/bin/systemd-analyze verify /etc/systemd/system/baci-cwv-containerd.service /etc/systemd/system/baci-cwv-docker.service /etc/systemd/system/baci-cwv-measurement.service /etc/systemd/system/baci-cwv-host-sampler.service /etc/systemd/system/baci-cwv-host-sampler.timer /etc/systemd/system/baci-cwv-campaign-watchdog@.service
  unit_states="$BOOTSTRAP_DIRECTORY/unit-states.json"; /usr/bin/printf '%s\n' "$UNIT_STATES" >"$unit_states"; /bin/chmod 0600 "$unit_states"; /usr/bin/sync -f "$unit_states"
  /usr/bin/node "$SCRIPT_DIR/install-bootstrap-controller.mjs" complete "$BOOTSTRAP_DIRECTORY" "$unit_states"
  if [ "${BACI_CWV_BOOTSTRAP_REPLACEMENT-}" = 1 ]; then /usr/bin/node "$SCRIPT_DIR/install-bootstrap-controller.mjs" replacement-complete "$BOOTSTRAP_DIRECTORY"; fi
  trap - EXIT HUP INT TERM; /bin/rm -f -- "$plan"
}
assert_bootstrap() {
  if ! regular "$ROOT/sealed/bootstrap.sha256" || ! root_mode "$ROOT/sealed/bootstrap.sha256" 'root:root:600'; then die 'bootstrap receipt required'; fi
  if ! regular "$ROOT/sealed/policy.sha256" || ! root_mode "$ROOT/sealed/policy.sha256" 'root:baci-cwv:640'; then die 'policy receipt required'; fi
  [ "$(/bin/cat "$ROOT/sealed/policy.sha256")" = "$(sha256 "$SCRIPT_DIR/policy.json")" ] || die 'policy receipt drift'
  source_sha=${SCRIPT_DIR##*/}; git_sha "$source_sha" || die 'invalid sealed source identity'
  directory="$BOOTSTRAP_ROOT/bootstrap-$(/usr/bin/printf '%s' "$source_sha" | /usr/bin/cut -c1-12)"
  manifest_sha=$(/bin/cat "$ROOT/sealed/source-manifest.sha256")
  /usr/bin/node "$SCRIPT_DIR/install-bootstrap-controller.mjs" verify-current "$directory" "$SCRIPT_DIR" "$source_sha" "$manifest_sha" "$(sha256 "$SCRIPT_DIR/policy.json")" "$(sha256 "$SCRIPT_DIR/install.sh")" "bootstrap-$(/usr/bin/printf '%s' "$source_sha" | /usr/bin/cut -c1-12)" >/dev/null || die 'complete bootstrap transaction required'
  if [ -e "$directory/replacement-intent.json" ] || [ -L "$directory/replacement-intent.json" ] || [ -e "$directory/replacement-receipt.json" ] || [ -L "$directory/replacement-receipt.json" ]; then /usr/bin/node "$SCRIPT_DIR/install-bootstrap-controller.mjs" replacement-verify "$directory" >/dev/null || die 'complete bootstrap replacement required'; fi
}
lstat_external() {
  row=$(/usr/bin/stat -c '%F|%d|%i' -- "$1") || die 'external input lstat failed'
  [ "${row%%|*}" = 'regular file' ] || die 'external input must be opaque regular path'
  /usr/bin/printf '%s\n' "${row#*|}"
}
dedicated_docker() {
  /usr/bin/systemd-run --quiet --scope --collect --slice=cwv-measurement-control.slice -- \
    /usr/bin/docker --host=unix:///run/baci-cwv/docker.sock "$@"
}
start_prepare_supervisor() {
  supervisor_directory="$state_directory/supervisor"
  parent_start=$(/usr/bin/awk '{print $22}' "/proc/$$/stat") || die 'prepare supervisor parent identity failed'
  /usr/bin/printf '%s' "$parent_start" | /usr/bin/grep -Eq '^[0-9]+$' || die 'prepare supervisor parent identity failed'
  /usr/bin/node "$SCRIPT_DIR/install-prepare-live-supervisor-cli.mjs" watch "$transaction" \
    "$campaign_directory/capture.json" "$capture_sha" "$SCRIPT_DIR/policy.json" \
    "$supervisor_directory" "$parent_start" >"$state_directory/supervisor.log" 2>&1 &
  supervisor_pid=$!
  attempt=0
  until [ -f "$supervisor_directory/supervisor-ready.json" ]; do
    /bin/kill -0 "$supervisor_pid" 2>/dev/null || die 'prepare supervisor failed before ready'
    attempt=$((attempt + 1)); [ "$attempt" -lt 40 ] || die 'prepare supervisor readiness timeout'
    /bin/sleep 0.1
  done
}
stop_prepare_supervisor() {
  if /bin/kill -0 "$supervisor_pid" 2>/dev/null; then
    /usr/bin/node "$SCRIPT_DIR/install-prepare-live-supervisor-cli.mjs" stop "$supervisor_directory"
  fi
  if ! wait "$supervisor_pid"; then
    [ -f "$supervisor_directory/supervisor-receipt.json" ] || die 'prepare supervisor safety breach'
  fi
  supervisor_pid=''
}
prepare() {
  [ "$#" -eq 8 ] || die 'invalid prepare arguments'; assert_bootstrap; assert_containerd_compatible
  [ "$1" = --image-archive ] && [ "$3" = --image-archive-sha256 ] && [ "$5" = --build-receipt ] && [ "$7" = --build-receipt-sha256 ] || die 'invalid prepare arguments'
  if ! is_sha "$4" || ! is_sha "$8"; then
    die 'owner frozen input digest mismatch'
  fi
  archive_identity=$(lstat_external "$2"); receipt_identity=$(lstat_external "$6")
  transaction="prepare-$(/bin/cat /proc/sys/kernel/random/uuid | /usr/bin/tr -d -)"
  state_directory="$PREPARE_ROOT/$transaction"; /usr/bin/install -d -m 0700 -o root -g root "$state_directory"
  /usr/bin/jq -cn --arg transaction "$transaction" --arg archive "$2" --arg archiveDevice "${archive_identity%%:*}" --arg archiveInode "${archive_identity#*:}" --arg receipt "$6" --arg receiptDevice "${receipt_identity%%:*}" --arg receiptInode "${receipt_identity#*:}" --arg archiveSha "$4" --arg receiptSha "$8" --arg manifestSha "$(/bin/cat "$ROOT/sealed/source-manifest.sha256")" --arg policySha "$(/bin/cat "$ROOT/sealed/policy.sha256")" '{transactionId:$transaction,external:{archive:{path:$archive,device:$archiveDevice,inode:$archiveInode},receipt:{path:$receipt,device:$receiptDevice,inode:$receiptInode}},expected:{archiveSha256:$archiveSha,receiptSha256:$receiptSha},sourceManifestSha256:$manifestSha,policyFileSha256:$policySha}' >"$state_directory/capture-input.json"
  /usr/bin/node "$SCRIPT_DIR/install-prepare-controller.mjs" capture "$state_directory" "$state_directory/capture-input.json" >/dev/null
  capture_sha=''; campaign_directory=''; supervisor_pid=''; supervisor_directory=''
  prepare_cleanup() {
    status=$?; trap - EXIT HUP INT TERM
    if [ -n "${supervisor_pid-}" ]; then
      /usr/bin/node "$SCRIPT_DIR/install-prepare-live-supervisor-cli.mjs" stop "$supervisor_directory" >/dev/null 2>&1 || status=1
      wait "$supervisor_pid" 2>/dev/null || status=1
    fi
    if [ -n "$capture_sha" ] && [ -n "$campaign_directory" ] && [ ! -e "$campaign_directory/restored.json" ]; then "$SCRIPT_DIR/campaign-restore.sh" "$transaction" "$capture_sha" || status=1; fi
    exit "$status"
  }
  trap prepare_cleanup EXIT HUP INT TERM
  capture_sha=$("$SCRIPT_DIR/campaign-quiesce.sh" prepare "$transaction")
  campaign_directory="$ROOT/campaigns/$transaction"
  /usr/bin/node "$SCRIPT_DIR/install-prepare-controller.mjs" arm-watchdog "$state_directory" "$capture_sha" >/dev/null
  destination="$ROOT/import/$transaction"; ensure_directory "$destination" 0700 root:root
  /usr/bin/node "$SCRIPT_DIR/install-prepare-controller.mjs" owned-receipt "$ROOT/import" "$transaction" tree mutable >"$campaign_directory/prepare-import-receipt.json"
  /usr/bin/node "$SCRIPT_DIR/install-prepare-controller.mjs" journal-owned "$ROOT/campaigns" "$transaction" prepare-import-created "$campaign_directory/prepare-import-receipt.json"
  /usr/bin/node "$SCRIPT_DIR/install-prepare-content-cleanup-cli.mjs" capture "$transaction" "$campaign_directory" >/dev/null
  /usr/bin/node "$ROOT/sealed/campaign-state.mjs" journal "$ROOT/campaigns" "$transaction" prepare-content-roots-captured "$(sha256 "$campaign_directory/prepare-content-roots.json")"
  /usr/bin/node "$SCRIPT_DIR/install-prepare-content-cleanup-cli.mjs" activate "$transaction" "$campaign_directory"
  archive="$destination/archive"; receipt="$destination/build-receipt.json"
  /usr/bin/node "$SCRIPT_DIR/install-input-copy.mjs" copy "$2" "$archive" "${archive_identity%%:*}" "${archive_identity#*:}" "$4" 17179869184 >/dev/null
  /usr/bin/node "$SCRIPT_DIR/install-input-copy.mjs" copy "$6" "$receipt" "${receipt_identity%%:*}" "${receipt_identity#*:}" "$8" 1048576 >/dev/null
  /usr/bin/jq -cn --arg archive "$4" --arg receipt "$8" --slurpfile build "$receipt" '{archiveSha256:$archive,receiptSha256:$receipt,buildReceipt:$build[0]}' >"$state_directory/copied.json"
  /usr/bin/node "$SCRIPT_DIR/install-prepare-controller.mjs" verify-copies "$state_directory" "$state_directory/copied.json" >/dev/null
  ensure_file "$receipt" "$state_directory/build-receipt.json" 0600 root:root
  start_prepare_supervisor
  /usr/bin/node "$ROOT/sealed/campaign-state.mjs" journal "$ROOT/campaigns" "$transaction" start-dedicated-unit baci-cwv-containerd.service
  /bin/systemctl start baci-cwv-containerd.service
  /usr/bin/node "$ROOT/sealed/campaign-state.mjs" journal "$ROOT/campaigns" "$transaction" start-dedicated-unit baci-cwv-docker.service
  /bin/systemctl start baci-cwv-docker.service
  synthetic_archive="$destination/synthetic-rootfs.tar"
  /usr/bin/node "$SCRIPT_DIR/install-prepare-synthetic.mjs" create "$synthetic_archive" >"$state_directory/synthetic-build.json"
  synthetic_image=$(dedicated_docker import "$synthetic_archive")
  /usr/bin/printf '%s' "$synthetic_image" | /usr/bin/grep -Eq '^sha256:[a-f0-9]{64}$' || die 'invalid synthetic image identity'
  dedicated_docker run --rm --network=none --read-only --label "baci.cwv.transaction=$transaction" --entrypoint /probe "$synthetic_image"
  dedicated_docker image rm "$synthetic_image" >/dev/null
  if dedicated_docker image inspect "$synthetic_image" >/dev/null 2>&1; then die 'synthetic image cleanup failed'; fi
  /bin/rm -f -- "$synthetic_archive"
  /usr/bin/jq -cn '{networkMode:"none",cleaned:true,productionUnchanged:true,dedicatedSocket:"/run/baci-cwv/docker.sock"}' >"$state_directory/synthetic.json"
  /usr/bin/node "$SCRIPT_DIR/install-prepare-controller.mjs" prove-synthetic "$state_directory" "$state_directory/synthetic.json" >/dev/null
  /bin/systemctl stop baci-cwv-docker.service baci-cwv-containerd.service
  [ ! -S /run/baci-cwv/docker.sock ] && [ ! -S /run/baci-cwv/containerd/containerd.sock ] || die 'synthetic runtime did not stop'
  /usr/bin/node "$ROOT/sealed/campaign-state.mjs" journal "$ROOT/campaigns" "$transaction" start-dedicated-unit baci-cwv-containerd.service
  /bin/systemctl start baci-cwv-containerd.service
  /usr/bin/node "$ROOT/sealed/campaign-state.mjs" journal "$ROOT/campaigns" "$transaction" start-dedicated-unit baci-cwv-docker.service
  /bin/systemctl start baci-cwv-docker.service
  dedicated_docker load --input "$archive" >/dev/null
  image_id=$(/usr/bin/jq -er .imageId "$receipt"); [ "$(dedicated_docker image inspect --format '{{.Id}}' "$image_id")" = "$image_id" ] || die 'loaded image identity mismatch'
  /bin/systemctl stop baci-cwv-docker.service baci-cwv-containerd.service; /bin/systemctl start baci-cwv-containerd.service; /bin/systemctl start baci-cwv-docker.service
  [ "$(dedicated_docker image inspect --format '{{.Id}}' "$image_id")" = "$image_id" ] || die 'retained image identity mismatch'
  /bin/systemctl stop baci-cwv-docker.service baci-cwv-containerd.service
  [ ! -S /run/baci-cwv/docker.sock ] && [ ! -S /run/baci-cwv/containerd/containerd.sock ] || die 'target runtime did not stop'
  stop_prepare_supervisor
  supervisor_sha=$(/usr/bin/jq -er .sha256 "$supervisor_directory/supervisor-receipt.json")
  /usr/bin/jq -cn --arg image "$image_id" --arg supervisor "$supervisor_sha" '{imageId:$image,imageConfigDigest:$image,productionUnchanged:true,supervisorReceiptSha256:$supervisor}' >"$state_directory/target.json"
  runtime_manifest_directory="$state_directory/runner-runtime"; ensure_directory "$runtime_manifest_directory" 0700 root:root; ensure_file "$state_directory/build-receipt.json" "$state_directory/runner-runtime-image-receipt.json" 0400 root:root
  /usr/bin/node "$SCRIPT_DIR/runner-runtime-manifest-producer-cli.mjs" --write --archive "$archive" --image-receipt "$state_directory/runner-runtime-image-receipt.json" --source-manifest "$ROOT/source-receipts/${SCRIPT_DIR##*/}/manifest.json" --source-manifest-sha256 "$(/bin/cat "$ROOT/sealed/source-manifest.sha256")" --output-directory "$runtime_manifest_directory" --projection-directory "$state_directory/runner-runtime-projection" >"$state_directory/runner-runtime-producer.json"
  /usr/bin/node "$SCRIPT_DIR/install-prepare-runtime-receipt.mjs" verify "$state_directory" "$state_directory/build-receipt.json" "$image_id"
  /usr/bin/node "$SCRIPT_DIR/install-prepare-controller.mjs" accept-target "$state_directory" "$state_directory/target.json" >/dev/null
  /usr/bin/node "$SCRIPT_DIR/install-prepare-acceptance.mjs" publish "$state_directory" "$ROOT" >"$state_directory/acceptance-receipt.json"
  "$SCRIPT_DIR/campaign-restore.sh" "$transaction" "$capture_sha"; trap - EXIT HUP INT TERM
}
verify() {
  assert_bootstrap
  source_sha=${SCRIPT_DIR##*/}
  directory="$BOOTSTRAP_ROOT/bootstrap-$(/usr/bin/printf '%s' "$source_sha" | /usr/bin/cut -c1-12)"
  /usr/bin/node "$SCRIPT_DIR/install-verify.mjs" live "$ROOT" "$directory" "$PREPARE_ROOT"
}
root_runtime_controller() {
  assert_bootstrap
  exec /usr/bin/node "$SCRIPT_DIR/root-runtime-executor.mjs" "$@"
}
root_required
case "${1-}" in
  --bootstrap-control) shift; bootstrap "$@" ;;
  --prepare) shift; prepare "$@" ;;
  --verify) [ "$#" -eq 1 ] || die 'invalid verify arguments'; verify ;;
  --register-token-stdin) [ "$#" -eq 1 ] || die 'invalid registration arguments'; root_runtime_controller register-token-stdin ;;
  --probe-isolation) [ "$#" -eq 2 ] || die 'invalid isolation probe arguments'; root_runtime_controller probe-isolation "$2" ;;
  --probe-runtime-identity) [ "$#" -eq 1 ] || die 'invalid runtime identity probe arguments'; root_runtime_controller probe-runtime-identity ;;
  *) die 'unsupported installer mode' ;;
esac
