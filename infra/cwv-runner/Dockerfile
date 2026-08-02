ARG UBUNTU_IMAGE
FROM ${UBUNTU_IMAGE} AS verifier

ARG UBUNTU_IMAGE
ARG UBUNTU_SNAPSHOT
ARG UBUNTU_SOURCES_BASE64
ARG RUNNER_URL
ARG RUNNER_SHA256
ARG RUNNER_VERSION
ARG RUNNER_ASSET_ID
ARG RUNNER_ALLOWED_FINAL_ORIGINS
ARG COMMAND_SETTINGS_URL
ARG COMMAND_SETTINGS_SHA256
ARG COMMAND_SETTINGS_ALLOWED_FINAL_ORIGINS
ARG NODE_URL
ARG NODE_SHA256
ARG NODE_VERSION
ARG NODE_ALLOWED_FINAL_ORIGINS
ARG PNPM_METADATA_URL
ARG PNPM_URL
ARG PNPM_SHA256
ARG PNPM_INTEGRITY
ARG PNPM_SHA1
ARG PNPM_VERSION
ARG PNPM_ALLOWED_FINAL_ORIGINS
ARG CHROME_URL
ARG CHROME_SHA256
ARG CHROME_VERSION
ARG CHROME_ALLOWED_FINAL_ORIGINS
ARG CHROME_INRELEASE_SHA256
ARG CHROME_PACKAGES_SHA256
ARG CHROME_SIGNING_KEY_SHA256
ARG SUPPLY_CHAIN_PROVENANCE_JSON

COPY infra/cwv-runner/download-artifact.sh infra/cwv-runner/verify-node-bootstrap.sh infra/cwv-runner/verify-apt-snapshot.sh infra/cwv-runner/verify-base-tools.sh /opt/baci-cwv/
COPY infra/cwv-runner/supply-chain-provenance.mjs infra/cwv-runner/openpgp-keyring.mjs infra/cwv-runner/bounded-semantic-fetch.mjs infra/cwv-runner/canonical-json.mjs infra/cwv-runner/command-settings-contract.mjs infra/cwv-runner/policy.schema.mjs /opt/baci-cwv/
COPY infra/cwv-runner/archive-index.mjs infra/cwv-runner/archive-link-validation.mjs infra/cwv-runner/archive-stream.mjs infra/cwv-runner/image-process-map.mjs infra/cwv-runner/rootfs-projection-contract.mjs infra/cwv-runner/rootfs-source-inventory.mjs infra/cwv-runner/rootfs-source-membership.mjs infra/cwv-runner/rootfs-source-membership-input.mjs infra/cwv-runner/rootfs-source-membership-write.mjs /opt/baci-cwv/
COPY infra/cwv-runner/policy.json /opt/baci-cwv/policy.json

SHELL ["/usr/bin/bash", "-c"]

RUN set -euo pipefail; \
    chmod 0555 /opt/baci-cwv/*.sh; mkdir -p /opt/baci-cwv/provenance; \
    inventory=/tmp/base-tools.tsv; raw=/tmp/base-tools.raw; : >"$raw"; \
    emit() { role=$1; path=$2; owner_path=${3:-$path}; package=$(dpkg-query -S "$owner_path"); package=${package%%:*}; \
      version=$(dpkg-query -W -f='${Version}' "$package"); mode=$(stat -Lc '%a' "$path"); \
      owner=$(stat -Lc '%u:%g' "$path"); identity=$(stat -c '%N' "$path"); digest=$(sha256sum "$path"); \
      printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$role" "$path" "$package" "$version" "$mode" "$owner" "$identity" "${digest%% *}" >>"$raw"; }; \
    emit apt-get /usr/bin/apt-get; emit awk /usr/bin/awk /usr/bin/mawk; emit awk:alternative /etc/alternatives/awk /usr/bin/mawk; emit awk:target /usr/bin/mawk; emit base64 /usr/bin/base64; \
    emit bash /usr/bin/bash; emit chmod /usr/bin/chmod; emit cp /usr/bin/cp; emit dpkg /usr/bin/dpkg; \
    emit dpkg-query /usr/bin/dpkg-query; emit find /usr/bin/find; emit gpgv /usr/bin/gpgv; \
    emit grep /usr/bin/grep; emit ldd /usr/bin/ldd; emit mkdir /usr/bin/mkdir; \
    emit mktemp /usr/bin/mktemp; emit mv /usr/bin/mv; emit readlink /usr/bin/readlink; \
    emit rm /usr/bin/rm; emit sha256sum /usr/bin/sha256sum; emit sort /usr/bin/sort; \
    emit stat /usr/bin/stat; emit timeout /usr/bin/timeout; emit wc /usr/bin/wc; \
    emit keyring /usr/share/keyrings/ubuntu-archive-keyring.gpg; \
    loader=$(readlink -f /lib64/ld-linux-x86-64.so.2); emit interpreter:loader "$loader"; \
    closure_tools=(/usr/bin/apt-get /usr/bin/awk /usr/bin/base64 /usr/bin/bash /usr/bin/chmod /usr/bin/cp /usr/bin/dpkg \
      /usr/bin/dpkg-query /usr/bin/find /usr/bin/gpgv /usr/bin/grep /usr/bin/ldd /usr/bin/mkdir \
      /usr/bin/mktemp /usr/bin/mv /usr/bin/readlink /usr/bin/rm /usr/bin/sha256sum /usr/bin/sort \
      /usr/bin/stat /usr/bin/timeout /usr/bin/wc); \
    for executable in "${closure_tools[@]}"; do \
      canonical=$(readlink -f "$executable"); test "$canonical" != /usr/bin/ldd || canonical=/usr/bin/bash; \
      ldd "$canonical"; \
    done | awk '{ for (i=1; i<=NF; i++) if ($i ~ /^\//) print $i }' \
      | while read -r path; do readlink -f "$path"; done | sort -u > /tmp/base-libraries; \
    while read -r library; do \
      test "$library" = "$loader" || emit "library:${library//\//_}" "$library"; \
    done < /tmp/base-libraries; \
    sort -t "$(printf '\t')" -k1,1 "$raw" >"$inventory"; \
    cp "$inventory" /opt/baci-cwv/base-tools.tsv; chmod 0444 /opt/baci-cwv/base-tools.tsv; \
    /opt/baci-cwv/verify-base-tools.sh "$UBUNTU_IMAGE" "$inventory" \
      /opt/baci-cwv/provenance/base-tools.json >/opt/baci-cwv/provenance/.base-tools.sha256; \
    keyring=/usr/share/keyrings/ubuntu-archive-keyring.gpg; \
    keyring_before=$(sha256sum "$keyring" | awk '{print $1}'); \
    rm -f /etc/apt/sources.list; \
    find /etc/apt/sources.list.d -mindepth 1 -maxdepth 1 -type f \( -name '*.list' -o -name '*.sources' \) -delete; \
    test -z "$(find /etc/apt/sources.list.d -mindepth 1 -maxdepth 1 -type f -print -quit)"; \
    printf '%s' "$UBUNTU_SOURCES_BASE64" | base64 -d >/etc/apt/sources.list.d/.baci.sources.tmp; \
    test "$(grep -c '^Snapshot: ' /etc/apt/sources.list.d/.baci.sources.tmp)" -eq 2; \
    test "$(grep -c "^Snapshot: $UBUNTU_SNAPSHOT$" /etc/apt/sources.list.d/.baci.sources.tmp)" -eq 2; \
    ! grep -Eq '(^|[[:space:]])http:|deb-src|\$\{' /etc/apt/sources.list.d/.baci.sources.tmp; \
    mv /etc/apt/sources.list.d/.baci.sources.tmp /etc/apt/sources.list.d/baci.sources; \
    test "$(sha256sum "$keyring" | awk '{print $1}')" = "$keyring_before"; \
    sources_sha=$(sha256sum /etc/apt/sources.list.d/baci.sources | awk '{print $1}'); \
    apt-get -o Acquire::AllowInsecureRepositories=false -o Acquire::AllowWeakRepositories=false \
      -o APT::Get::AllowUnauthenticated=false -o Acquire::GzipIndexes=false update; \
    test "$(find /var/lib/apt/lists -maxdepth 1 -type f -name '*_InRelease' | wc -l)" -eq 3; \
    test "$(find /var/lib/apt/lists -maxdepth 1 -type f -name '*_Packages' | wc -l)" -eq 12; \
    apt_work=$(mktemp -d); mkdir -p "$apt_work/archives/partial"; \
    ubuntu_source_packages=(bash ca-certificates coreutils curl dash dpkg fonts-liberation git grep iproute2 jq libasound2t64 libc6 mawk libatk-bridge2.0-0 libcups2 libgbm1 libgtk-3-0t64 libnspr4 libnss3 libudev1 libvulkan1 procps util-linux xdg-utils); \
    build_only_packages=(gpgv unzip xz-utils); \
    apt-get -o Acquire::AllowInsecureRepositories=false -o Acquire::AllowWeakRepositories=false \
      -o APT::Get::AllowUnauthenticated=false -o Dir::Cache::archives="$apt_work/archives" \
      --download-only --reinstall install -y --no-install-recommends \
      "${ubuntu_source_packages[@]}" "${build_only_packages[@]}"; \
    /opt/baci-cwv/verify-base-tools.sh "$UBUNTU_IMAGE" /opt/baci-cwv/base-tools.tsv /tmp/base-tools-before-dpkg.json >/dev/null; \
    dpkg -i "$apt_work"/archives/*.deb; test -z "$(dpkg --audit)"; \
    closure_source_packages() { { for package in "${ubuntu_source_packages[@]}"; do while IFS= read -r executable; do test -f "$executable" || continue; canonical=$(readlink -f "$executable"); test "$(head -c 4 "$canonical")" = $'\177ELF' || continue; ldd "$canonical" 2>/dev/null | awk '{ for (i = 1; i <= NF; i++) if ($i ~ /^\//) print $i }'; done < <(dpkg-query -L "$package"); done; cat /tmp/base-libraries; } | while IFS= read -r path; do dpkg-query -S "$(readlink -f "$path")" 2>/dev/null | awk -F: 'NR == 1 { print $1 }'; done | sort -u; }; \
    runtime_closure_source_packages=($(closure_source_packages)); test "${#runtime_closure_source_packages[@]}" -gt 0; \
    apt-get -o Acquire::AllowInsecureRepositories=false -o Acquire::AllowWeakRepositories=false -o APT::Get::AllowUnauthenticated=false -o Dir::Cache::archives="$apt_work/archives" --download-only --reinstall install -y --no-install-recommends "${runtime_closure_source_packages[@]}"; \
    /opt/baci-cwv/verify-base-tools.sh "$UBUNTU_IMAGE" /opt/baci-cwv/base-tools.tsv /tmp/base-tools-before-apt.json >/dev/null; \
    ubuntu_receipt_sha=$(/opt/baci-cwv/verify-apt-snapshot.sh "$keyring" /var/lib/apt/lists \
      "$apt_work/archives" "$UBUNTU_SNAPSHOT" /etc/apt/sources.list.d/baci.sources \
      /tmp/base-tools-before-apt.json \
      /opt/baci-cwv/provenance/ubuntu.json); \
    test "$(sha256sum /opt/baci-cwv/provenance/ubuntu.json | awk '{print $1}')" = "$ubuntu_receipt_sha"; \
    printf '%s' "$ubuntu_receipt_sha" >/opt/baci-cwv/provenance/.ubuntu.sha256; chmod 0444 /opt/baci-cwv/provenance/.ubuntu.sha256; \
    source_debs=/opt/baci-cwv/source-archives/deb; mkdir -p "$source_debs"; for archive in "$apt_work"/archives/*.deb; do source_sha=$(sha256sum "$archive" | awk '{print $1}'); cp "$archive" "$source_debs/$source_sha.deb"; dpkg-deb --fsys-tarfile "$archive" >"$source_debs/$source_sha.tar"; done; \
    test "$(sha256sum /etc/apt/sources.list.d/baci.sources | awk '{print $1}')" = "$sources_sha"; \
    test "$(sha256sum "$keyring" | awk '{print $1}')" = "$keyring_before"; \
    rm -rf "$apt_work"

RUN set -euo pipefail; \
    work=$(mktemp -d); trap 'rm -rf "$work"' EXIT HUP INT TERM; \
    provenance="$work/provenance.json"; printf '%s' "$SUPPLY_CHAIN_PROVENANCE_JSON" >"$provenance"; \
    media_types() { jq -ce --arg role "$1" '.immutableArtifactMediaTypes[$role]' "$provenance"; }; \
    artifact_max_bytes=$(printf '%s' "$SUPPLY_CHAIN_PROVENANCE_JSON" | awk 'match($0, /"artifactMaxBytes":[0-9]+/) { print substr($0, RSTART + 19, RLENGTH - 19); exit }'); \
    [[ "$artifact_max_bytes" =~ ^[1-9][0-9]*$ ]]; \
    test "$(jq -er '.runner.assetSize <= .artifactMaxBytes' "$provenance")" = true; \
    test "$(jq -er '.runner.assetId | tostring' "$provenance")" = "$RUNNER_ASSET_ID"; \
    test "$(jq -er '.pnpm.metadataUrl' "$provenance")" = "$PNPM_METADATA_URL"; \
    test "$(jq -er '.pnpm.distShasum' "$provenance")" = "$PNPM_SHA1"; \
    test "$(jq -er '.chrome.inReleaseSha256' "$provenance")" = "$CHROME_INRELEASE_SHA256"; \
    test "$(jq -er '.chrome.packagesSha256' "$provenance")" = "$CHROME_PACKAGES_SHA256"; \
    test "$(jq -er '.chrome.signingKeySha256' "$provenance")" = "$CHROME_SIGNING_KEY_SHA256"; \
    /opt/baci-cwv/download-artifact.sh "$COMMAND_SETTINGS_URL" "$COMMAND_SETTINGS_SHA256" \
      "$COMMAND_SETTINGS_ALLOWED_FINAL_ORIGINS" "$work/command-settings" "$artifact_max_bytes" "$(media_types commandSettings)"; \
    node_name=$(basename "${NODE_URL%%\?*}"); \
    /opt/baci-cwv/download-artifact.sh "$NODE_URL" "$NODE_SHA256" "$NODE_ALLOWED_FINAL_ORIGINS" "$work/$node_name" "$artifact_max_bytes" "$(media_types node.archive)"; \
    for item in checksums signature keyring; do \
      url=$(jq -er ".node.${item}Url" "$provenance"); \
      digest=$(jq -er ".node.${item}Sha256" "$provenance"); \
      origins=$(jq -c '.node.allowedFinalOrigins' "$provenance"); \
      /opt/baci-cwv/download-artifact.sh "$url" "$digest" "$origins" "$work/node-$item" "$artifact_max_bytes" "$(media_types "node.$item")"; \
    done; \
    base_tools_receipt_sha=$(/opt/baci-cwv/verify-base-tools.sh "$UBUNTU_IMAGE" /opt/baci-cwv/base-tools.tsv "$work/base-tools-before-node.json"); \
    node_receipt_sha=$(/opt/baci-cwv/verify-node-bootstrap.sh "$work/$node_name" "$work/node-checksums" \
      "$work/node-signature" "$work/node-keyring" "$NODE_SHA256" \
      "$(jq -er '.node.checksumsSha256' "$provenance")" \
      "$(jq -er '.node.signatureSha256' "$provenance")" \
      "$(jq -er '.node.keyringSha256' "$provenance")" \
      "$base_tools_receipt_sha" \
      "$work/base-tools-before-node.json" "$work/node-receipt.json"); \
    mkdir -p "$work/node"; tar -xJf "$work/$node_name" -C "$work/node" --strip-components=1; \
    test -x "$work/node/bin/node"; \
    node_provenance_receipt_sha=$(/opt/baci-cwv/verify-node-bootstrap.sh augment "$work/node-receipt.json" "$node_receipt_sha" "$work/base-tools-before-node.json" "$base_tools_receipt_sha" "$work/node/bin/node" "$work/node-provenance.json"); \
    test "$(sha256sum "$work/node-provenance.json" | awk '{print $1}')" = "$node_provenance_receipt_sha"; \
    /opt/baci-cwv/download-artifact.sh "$RUNNER_URL" "$RUNNER_SHA256" "$RUNNER_ALLOWED_FINAL_ORIGINS" "$work/runner.artifact" "$artifact_max_bytes" "$(media_types runner.archive)"; \
    /opt/baci-cwv/download-artifact.sh "$PNPM_URL" "$PNPM_SHA256" "$PNPM_ALLOWED_FINAL_ORIGINS" "$work/pnpm.artifact" "$artifact_max_bytes" "$(media_types pnpm.archive)"; \
    /opt/baci-cwv/download-artifact.sh "$CHROME_URL" "$CHROME_SHA256" "$CHROME_ALLOWED_FINAL_ORIGINS" "$work/chrome.artifact" "$artifact_max_bytes" "$(media_types chrome.archive)"; \
    source_artifacts=/opt/baci-cwv/source-archives/artifacts; mkdir -p "$source_artifacts"; cp "$work/runner.artifact" "$source_artifacts/runner.archive"; gzip -dc "$work/runner.artifact" >"$source_artifacts/runner.tar"; cp "$work/pnpm.artifact" "$source_artifacts/pnpm.archive"; gzip -dc "$work/pnpm.artifact" >"$source_artifacts/pnpm.tar"; cp "$work/$node_name" "$source_artifacts/node.archive"; xz -dc "$work/$node_name" >"$source_artifacts/node.tar"; cp "$work/chrome.artifact" "$source_artifacts/chrome.archive"; dpkg-deb --fsys-tarfile "$work/chrome.artifact" >"$source_artifacts/chrome.tar"; \
    for item in inRelease packages signingKey; do \
      url=$(jq -er ".chrome.${item}Url" "$provenance"); \
      digest=$(jq -er ".chrome.${item}Sha256" "$provenance"); \
      origins=$(jq -c '.chrome.allowedFinalOrigins' "$provenance"); \
      /opt/baci-cwv/download-artifact.sh "$url" "$digest" "$origins" "$work/chrome-$item" "$artifact_max_bytes" "$(media_types "chrome.$item")"; \
    done; \
    owner_url=$(jq -er '.ownerCli.checksumsUrl' "$provenance"); \
    owner_digest=$(jq -er '.ownerCli.checksumsSha256' "$provenance"); \
    owner_origins=$(jq -c '.ownerCli.allowedFinalOrigins' "$provenance"); \
    /opt/baci-cwv/download-artifact.sh "$owner_url" "$owner_digest" "$owner_origins" "$work/owner-checksums" "$artifact_max_bytes" "$(media_types ownerCli.checksums)"; \
    owner_url=$(jq -er '.ownerCli.archiveUrl' "$provenance"); \
    owner_digest=$(jq -er '.ownerCli.archiveSha256' "$provenance"); \
    /opt/baci-cwv/download-artifact.sh "$owner_url" "$owner_digest" "$owner_origins" "$work/owner-archive" "$artifact_max_bytes" "$(media_types ownerCli.archive)"; \
    unzip -p "$work/owner-archive" '*/bin/gh' >"$work/owner-binary"; \
    jq -n --arg baseToolReceipt /opt/baci-cwv/provenance/base-tools.json --arg commandSettings "$work/command-settings" --arg nodeReceipt "$work/node-provenance.json" --arg nodeExecutable "$work/node/bin/node" \
      --arg runnerArtifact "$work/runner.artifact" --arg pnpmTarball "$work/pnpm.artifact" \
      --arg ubuntuReceipt /opt/baci-cwv/provenance/ubuntu.json \
      --arg ubuntuReceiptSha256 "$(cat /opt/baci-cwv/provenance/.ubuntu.sha256)" --arg chromeArtifact "$work/chrome.artifact" \
      --arg chromeInRelease "$work/chrome-inRelease" --arg chromePackages "$work/chrome-packages" \
      --arg chromeSigningKey "$work/chrome-signingKey" --arg ownerChecksums "$work/owner-checksums" \
      --arg ownerArchive "$work/owner-archive" --arg ownerBinary "$work/owner-binary" \
      '{baseToolReceipt:$baseToolReceipt,commandSettings:$commandSettings,ubuntuReceipt:$ubuntuReceipt,ubuntuReceiptSha256:$ubuntuReceiptSha256,nodeReceipt:$nodeReceipt,nodeExecutable:$nodeExecutable,runnerArtifact:$runnerArtifact,pnpmTarball:$pnpmTarball,chromeArtifact:$chromeArtifact,chromeInRelease:$chromeInRelease,chromePackages:$chromePackages,chromeSigningKey:$chromeSigningKey,ownerChecksums:$ownerChecksums,ownerArchive:$ownerArchive,ownerBinary:$ownerBinary}' >"$work/provenance-inputs.json"; \
    "$work/node/bin/node" /opt/baci-cwv/supply-chain-provenance.mjs verify \
      /opt/baci-cwv/policy.json "$work/provenance-inputs.json" >"$work/provenance-receipt.json"; \
    jq -e '.chrome and .commandSettings and .node and .ownerCli and .pnpm and .runner and .ubuntu' \
      "$work/provenance-receipt.json" >/dev/null; \
    "$work/node/bin/node" --input-type=module -e 'import { readFileSync, writeFileSync } from "node:fs"; import { serializeCommandSettingsReceipt } from "/opt/baci-cwv/command-settings-contract.mjs"; writeFileSync("/opt/baci-cwv/command-settings-receipt.json", serializeCommandSettingsReceipt(JSON.parse(readFileSync(process.argv[1], "utf8")).commandSettings));' "$work/provenance-receipt.json"; \
    for pair in runner:runner node:node pnpm:pnpm chrome:chrome ownerCli:owner-cli; do \
      key=${pair%%:*}; file=${pair#*:}; value=$(jq -cS ".$key" "$work/provenance-receipt.json"); \
      printf '%s' "$value" >"/opt/baci-cwv/provenance/$file.json"; \
    done; \
    test "$(find /opt/baci-cwv/provenance -maxdepth 1 -type f -name '*.json' | wc -l)" -eq 7; \
    rm -f /opt/baci-cwv/provenance/.ubuntu.sha256 /opt/baci-cwv/provenance/.base-tools.sha256; \
    chmod 0444 /opt/baci-cwv/provenance/*.json /opt/baci-cwv/command-settings-receipt.json; cp -R "$work/node" /opt/node; \
    mkdir -p /opt/runner /opt/pnpm; \
    tar -xzf "$work/runner.artifact" -C /opt/runner; \
    rm -f /opt/runner/config.sh /opt/runner/env.sh /opt/runner/run.sh /opt/runner/run-helper.sh.template /opt/runner/safe_sleep.sh; \
    rm -rf /opt/runner/diagnostics; rm -f /opt/runner/.credentials /opt/runner/.credentials_rsaparams /opt/runner/.runner /opt/runner/bin/installdependencies.sh /opt/runner/run-helper.cmd.template /opt/runner/run-helper.sh /opt/runner/svc.sh; \
    tar -xzf "$work/pnpm.artifact" -C /opt/pnpm --strip-components=1; \
    test -f /opt/pnpm/bin/pnpm.cjs; \
    printf '%s  %s\n' "$CHROME_SHA256" "$work/chrome.artifact" | sha256sum -c -; \
    dpkg -i "$work/chrome.artifact"; test -z "$(dpkg --audit)"; \
    test "$RUNNER_VERSION" && test "$NODE_VERSION" && test "$PNPM_VERSION" && test "$CHROME_VERSION"; \
    rm -rf /var/lib/apt/lists/* "$work"

COPY infra/cwv-runner/entrypoint.sh infra/cwv-runner/isolation-probe.sh /opt/baci-cwv/
COPY infra/cwv-runner/entrypoint.mjs infra/cwv-runner/entrypoint-runtime.mjs infra/cwv-runner/normal-release.mjs infra/cwv-runner/process-inventory.mjs infra/cwv-runner/registration-release.mjs infra/cwv-runner/direct-listener-conformance.mjs infra/cwv-runner/runner-identity-gate.mjs infra/cwv-runner/cwv-runner-authority.mjs infra/cwv-runner/cwv-runner-authority-core.mjs infra/cwv-runner/cwv-runner-authority-runtime.mjs infra/cwv-runner/cwv-runner-stable-attestation-builder.mjs infra/cwv-runner/sealed-runner.mjs infra/cwv-runner/registration-egress-probe.mjs /opt/baci-cwv/
COPY infra/cwv-runner/container-attest-runtime.mjs /opt/baci-cwv/container-attest-runtime.mjs

RUN set -euo pipefail; \
    chmod 0555 /opt/baci-cwv/entrypoint.sh /opt/baci-cwv/*.mjs /opt/baci-cwv/isolation-probe.sh; \
    mkdir -p /runtime-root/etc/ssl/certs; \
    projection=/tmp/rootfs-projection.tsv; inventory=/tmp/rootfs-source.tsv; : >"$projection"; : >"$inventory"; \
    projected() { awk -F '\t' -v path="$1" '$3 == path { found=1 } END { exit !found }' "$projection"; }; \
    inventoried() { awk -F '\t' -v path="$1" '$4 == path { found=1 } END { exit !found }' "$inventory"; }; \
    package_sha() { package=$1; if test "$package" = google-chrome-stable; then printf '%s' "$CHROME_SHA256"; else jq -er --arg name "$package" '[.packages[] | select(.name == $name) | .sha256] | if length == 1 then .[0] else error("package source") end' /opt/baci-cwv/provenance/ubuntu.json; fi; }; \
    inventory_path() { kind=$1; owner=$2; source_sha=$3; relative=${4#/}; inventoried "$relative" && return 0; test -e "/runtime-root/$relative" || test -L "/runtime-root/$relative" || return 0; printf '%s\t%s\t%s\t%s\n' "$kind" "$owner" "$source_sha" "$relative" >>"$inventory"; }; \
    project_path() { source=$1; kind=$2; owner=$3; test -e "$source" || test -L "$source" || return 0; \
      test ! -d "$source" || return 0; relative=${source#/}; projected "$relative" && return 0; \
      cp -a --parents "$source" /runtime-root; printf '%s\t%s\t%s\n' "$kind" "$owner" "$relative" >>"$projection"; }; \
    project_directory() { path=$1; owner=$2; mode=$3; relative=${path#/}; projected "$relative" && return 0; \
      mkdir -p "/runtime-root$path"; chown 10001:10001 "/runtime-root$path"; chmod "$mode" "/runtime-root$path"; \
      printf '%s\t%s\t%s\n' generated "$owner" "$relative" >>"$projection"; }; \
    runtime_packages=(bash ca-certificates coreutils curl dash fonts-liberation git grep google-chrome-stable iproute2 jq libasound2t64 libatk-bridge2.0-0 libc6 libcups2 libgbm1 libgtk-3-0t64 libnspr4 libnss3 libudev1 libvulkan1 mawk procps util-linux xdg-utils); \
    runtime_executable_root_packages=("${runtime_packages[@]}"); \
    for package in "${runtime_packages[@]}"; do \
      dpkg-query -W -f='${Status}' "$package" | grep -qx 'install ok installed'; \
      source_sha=$(package_sha "$package"); \
      while IFS= read -r path; do \
        if [[ "$package" = google-chrome-stable && "$path" = /opt/google/* ]]; then continue; fi; \
        project_path "$path" package "$package"; inventory_path deb "$package" "$source_sha" "$path"; \
      done < <(dpkg-query -L "$package"); \
    done; \
    project_path /usr/bin/awk generated awk-alternative; project_path /etc/alternatives/awk generated awk-alternative; \
    project_path /usr/bin/dpkg-query package dpkg; mkdir -p /runtime-root/var/lib/dpkg; \
    dpkg_architecture=$(dpkg-query -W -f='${Architecture}' google-chrome-stable); dpkg_version=$(dpkg-query -W -f='${Version}' google-chrome-stable); test -n "$dpkg_architecture"; test -n "$dpkg_version"; \
    printf 'Package: %s\nStatus: install ok installed\nArchitecture: %s\nVersion: %s\n\n' google-chrome-stable "$dpkg_architecture" "$dpkg_version" >/runtime-root/var/lib/dpkg/status; \
    chown root:root /runtime-root/var/lib/dpkg/status; chmod 0444 /runtime-root/var/lib/dpkg/status; printf '%s\t%s\t%s\n' generated dpkg-query var/lib/dpkg/status >>"$projection"; \
    project_artifact() { owner=$1; root=$2; source_sha=$3; source_kind=${4:-tarball}; source_owner=${5:-$owner}; while IFS= read -r -d '' path; do test "$owner:$path" = runner:/opt/runner/entrypoint.mjs && continue; project_path "$path" artifact "$owner"; inventory_path "$source_kind" "$source_owner" "$source_sha" "$path"; done < <(find "$root" -xdev \( -type f -o -type l \) -print0); }; \
    project_artifact chrome /opt/google "$CHROME_SHA256" deb google-chrome-stable; project_artifact node /opt/node "$NODE_SHA256"; \
    project_artifact pnpm /opt/pnpm "$PNPM_SHA256"; \
    cp /opt/baci-cwv/entrypoint.mjs /opt/runner/entrypoint.mjs; chown root:root /opt/runner/entrypoint.mjs; chmod 0444 /opt/runner/entrypoint.mjs; \
    project_artifact runner /opt/runner "$RUNNER_SHA256"; project_path /opt/runner/entrypoint.mjs declared baci; \
    printf '%b' 'runner:x:10001:10001:Baci CWV Runner:/home/runner:/bin/bash\n' >/runtime-root/etc/passwd; \
    printf '%b' 'runner:x:10001:\n' >/runtime-root/etc/group; chown root:root /runtime-root/etc/passwd /runtime-root/etc/group; chmod 0644 /runtime-root/etc/passwd /runtime-root/etc/group; \
    printf '%s\t%s\t%s\n' generated identity etc/passwd >>"$projection"; printf '%s\t%s\t%s\n' generated identity etc/group >>"$projection"; \
    ca_sources=$(mktemp); awk '!/^[[:space:]]*($|#|!)/ { print "/usr/share/ca-certificates/" $0 }' /etc/ca-certificates.conf | sort -u >"$ca_sources"; test -s "$ca_sources"; \
    while IFS= read -r certificate; do cat "$certificate"; done <"$ca_sources" >/runtime-root/etc/ssl/certs/ca-certificates.crt; rm -f "$ca_sources"; chown root:root /runtime-root/etc/ssl/certs/ca-certificates.crt; chmod 0444 /runtime-root/etc/ssl/certs/ca-certificates.crt; printf '%s\t%s\t%s\n' generated trust etc/ssl/certs/ca-certificates.crt >>"$projection"; \
    inventory_dependency() { path=$1; relative=${path#/}; inventoried "$relative" && return 0; package=$(dpkg-query -S "$path" 2>/dev/null | awk -F: 'NR == 1 { print $1 }'); source_sha=$(package_sha "$package") || exit 1; inventory_path deb "$package" "$source_sha" "$path"; }; \
    project_dependency() { path=$1; owner=$2; while :; do project_path "$path" closure "$owner"; inventory_dependency "$path"; test -L "$path" || break; target=$(readlink "$path"); [[ "$target" = /* ]] || target="${path%/*}/$target"; path=$(readlink -m "$target"); done; canonical=$(readlink -f "$path"); project_path "$canonical" closure "$owner"; inventory_dependency "$canonical"; }; \
    ldd_paths() { awk '{ for (i = 1; i <= NF; i++) if ($i ~ /^\//) print $i }' "$1" | sort -u; }; \
    project_closure() { owner=$1; executable=$2; test -f "$executable" || test -L "$executable"; canonical=$(readlink -f "$executable"); \
      project_dependency "$executable" "$owner"; closure=$(mktemp); \
      ldd "$canonical" >"$closure" 2>&1 || { grep -q 'not a dynamic executable' "$closure" && { rm -f "$closure"; return; }; exit 1; }; ! grep -q 'not found' "$closure"; \
      while read -r path; do project_dependency "$path" "$owner"; \
      done < <(ldd_paths "$closure"); rm -f "$closure"; }; \
    is_elf_regular_file() { path=$1; test -f "$path" && test "$(head -c 4 "$path")" = $'\177ELF'; }; \
    project_artifact_elf_closures() { owner=$1; root=$2; while IFS= read -r -d '' path; do is_elf_regular_file "$path" && project_closure "$owner" "$path"; done < <(find "$root" -xdev -type f -print0); }; \
    closure_roots=(shell:/bin/sh runtime-node:/opt/node/bin/node chrome:/opt/google/chrome/chrome listener:/opt/runner/bin/Runner.Listener worker:/opt/runner/bin/Runner.Worker plugin-host:/opt/runner/bin/Runner.PluginHost action-node:/opt/runner/externals/node24/bin/node dpkg-query:/usr/bin/dpkg-query isolation-probe:/usr/bin/mawk); \
    for pair in "${closure_roots[@]}"; do project_closure "${pair%%:*}" "${pair#*:}"; done; \
    for package in "${runtime_executable_root_packages[@]}"; do \
      while IFS= read -r path; do \
        is_elf_regular_file "$path" || continue; \
        project_closure "runtime-package-$package" "$path"; \
      done < <(dpkg-query -L "$package"); \
    done; \
    project_artifact_elf_closures listener /opt/runner; project_artifact_elf_closures chrome /opt/google; project_artifact_elf_closures runtime-node /opt/node; project_artifact_elf_closures runtime-node /opt/pnpm; \
    chrome_filename=$(/opt/node/bin/node -e 'const path=new URL(process.argv[1]).pathname; const marker="/deb/"; const index=path.indexOf(marker); if (index < 0 || index + marker.length === path.length) process.exit(1); process.stdout.write(path.slice(index + marker.length));' "$CHROME_URL"); chrome_version=$(jq -er '.version' /opt/baci-cwv/provenance/chrome.json); test "$chrome_version" = "$CHROME_VERSION"; \
    jq -nc --arg chrome "$CHROME_SHA256" --arg chromeFilename "$chrome_filename" --arg chromeVersion "$chrome_version" --arg node "$NODE_SHA256" --arg pnpm "$PNPM_SHA256" --arg runner "$RUNNER_SHA256" --arg root /opt/baci-cwv/source-archives/artifacts '{"google-chrome-stable":{archivePath:$root+"/chrome.tar",installPrefix:"",kind:"deb",source:{architecture:"amd64",filename:$chromeFilename,name:"google-chrome-stable",sha256:$chrome,version:$chromeVersion},sourceArchivePath:$root+"/chrome.archive",stripComponents:0},node:{archivePath:$root+"/node.tar",installPrefix:"opt/node",kind:"tarball",source:{sha256:$node},sourceArchivePath:$root+"/node.archive",stripComponents:1},pnpm:{archivePath:$root+"/pnpm.tar",installPrefix:"opt/pnpm",kind:"tarball",source:{sha256:$pnpm},sourceArchivePath:$root+"/pnpm.archive",stripComponents:1},runner:{archivePath:$root+"/runner.tar",installPrefix:"opt/runner",kind:"tarball",source:{sha256:$runner},sourceArchivePath:$root+"/runner.archive",stripComponents:0}}' >/tmp/rootfs-source-artifacts.json; \
    /opt/node/bin/node /opt/baci-cwv/rootfs-source-membership-input.mjs write "$inventory" /opt/baci-cwv/provenance/ubuntu.json /tmp/rootfs-source-artifacts.json /opt/baci-cwv/source-archives/deb /tmp/rootfs-source-membership-input.json; /opt/node/bin/node /opt/baci-cwv/rootfs-source-membership-write.mjs write /tmp/rootfs-source-membership-input.json /opt/baci-cwv/rootfs-source-membership.json; \
    /opt/node/bin/node /opt/baci-cwv/rootfs-source-inventory.mjs write "$inventory" /opt/baci-cwv/rootfs-source-inventory.json "/"; \
    /opt/node/bin/node /opt/baci-cwv/image-process-map.mjs write /opt/baci-cwv/policy.json /opt/baci-cwv/image-process-map.json; chown root:root /opt/baci-cwv/policy.json /opt/baci-cwv/image-process-map.json /opt/baci-cwv/rootfs-source-inventory.json /opt/baci-cwv/rootfs-source-membership.json; chmod 0444 /opt/baci-cwv/policy.json /opt/baci-cwv/image-process-map.json /opt/baci-cwv/rootfs-source-inventory.json /opt/baci-cwv/rootfs-source-membership.json; \
    baci_paths=(canonical-json.mjs command-settings-contract.mjs command-settings-receipt.json \
      container-attest-runtime.mjs \
      direct-listener-conformance.mjs entrypoint-runtime.mjs entrypoint.mjs entrypoint.sh \
      cwv-runner-authority.mjs cwv-runner-authority-core.mjs cwv-runner-authority-runtime.mjs cwv-runner-stable-attestation-builder.mjs image-process-map.json isolation-probe.sh normal-release.mjs policy.json policy.schema.mjs process-inventory.mjs rootfs-source-inventory.json rootfs-source-membership.json \
      registration-egress-probe.mjs registration-release.mjs runner-identity-gate.mjs sealed-runner.mjs \
      provenance/base-tools.json provenance/chrome.json provenance/node.json provenance/owner-cli.json \
      provenance/pnpm.json provenance/runner.json provenance/ubuntu.json); \
    for path in "${baci_paths[@]}"; do project_path "/opt/baci-cwv/$path" declared baci; done; \
    project_directory /home/runner directory 0700; project_directory /registration-staging directory 0700; \
    project_directory /runner-work directory 0700; project_directory /opt/runner/_diag directory 0700; \
    project_directory /tmp/baci-cwv directory 0700; \
    printf '%s\t%s\t%s\n' declared baci opt/baci-cwv/rootfs-projection.json >>"$projection"; \
    test "$(awk -F '\t' '{ print $3 }' "$projection" | sort -u | wc -l)" -eq "$(wc -l <"$projection")"; \
    /opt/node/bin/node --input-type=module -e 'import { readFileSync, writeFileSync } from "node:fs"; const entries = readFileSync(process.argv[1], "utf8").trim().split("\n").filter(Boolean).map((line) => { const [kind, owner, path] = line.split("\t"); return { kind, owner, path }; }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0); writeFileSync(process.argv[2], JSON.stringify({ entries, schemaVersion: 1 }));' "$projection" /runtime-root/opt/baci-cwv/rootfs-projection.json; \
    rm -rf /etc/apt /usr/share/keyrings /var/lib/apt /var/cache/apt /var/lib/dpkg; \
    rm -f /opt/baci-cwv/download-artifact.sh /opt/baci-cwv/verify-apt-snapshot.sh \
      /opt/baci-cwv/verify-base-tools.sh /opt/baci-cwv/verify-node-bootstrap.sh \
      /opt/baci-cwv/supply-chain-provenance.mjs /opt/baci-cwv/openpgp-keyring.mjs /opt/baci-cwv/bounded-semantic-fetch.mjs \
      /opt/baci-cwv/archive-index.mjs /opt/baci-cwv/archive-link-validation.mjs /opt/baci-cwv/archive-stream.mjs /opt/baci-cwv/image-process-map.mjs /opt/baci-cwv/rootfs-projection-contract.mjs /opt/baci-cwv/rootfs-source-inventory.mjs /opt/baci-cwv/rootfs-source-membership.mjs /opt/baci-cwv/rootfs-source-membership-input.mjs /opt/baci-cwv/rootfs-source-membership-write.mjs /tmp/rootfs-source-artifacts.json /tmp/rootfs-source-membership-input.json \
      /opt/baci-cwv/base-tools.tsv; \
    rm -rf /opt/baci-cwv/source-archives; \
    test -x /runtime-root/bin/sh; test -x /runtime-root/opt/node/bin/node; \
    test -x /runtime-root/usr/bin/dpkg-query; test -r /runtime-root/var/lib/dpkg/status; test "$(find /runtime-root/var/lib/dpkg -mindepth 1 -printf '%P\n')" = status; \
    test -r /runtime-root/etc/passwd; test -r /runtime-root/etc/group; \
    test -r /runtime-root/etc/ssl/certs/ca-certificates.crt
FROM scratch AS runtime

ARG SOURCE_MANIFEST_SHA256
COPY --from=verifier /runtime-root/ /

LABEL io.baci.cwv.source-manifest-sha256=$SOURCE_MANIFEST_SHA256
ENV PATH=/opt/node/bin:/opt/pnpm/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    LANG=C.UTF-8 LC_ALL=C.UTF-8 TZ=Etc/UTC
USER runner
WORKDIR /runner-work
ENTRYPOINT ["/opt/baci-cwv/entrypoint.sh"]
