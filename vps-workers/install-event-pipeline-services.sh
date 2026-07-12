#!/usr/bin/env bash
set -euo pipefail

REMOTE_DIR="${1:-$HOME/baci-workers}"
FLOCK_BIN="$(command -v flock)" || {
  echo "flock is required to install the event-pipeline services" >&2
  exit 1
}
SYSTEMD_DIR="$HOME/.config/systemd/user"

mkdir -p "$SYSTEMD_DIR" "$REMOTE_DIR/locks"

install_service() {
  local service_name="$1"
  local description="$2"
  local lock_name="$3"
  local wrapper_name="$4"

  cat > "$SYSTEMD_DIR/$service_name.service" <<EOF
[Unit]
Description=$description
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$REMOTE_DIR
Environment=NODE_ENV=production
ExecStart=$FLOCK_BIN -n $REMOTE_DIR/locks/$lock_name.lock $REMOTE_DIR/bin/$wrapper_name
Restart=on-failure
RestartSec=5
TimeoutStopSec=20
KillSignal=SIGTERM
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=default.target
EOF
}

install_service \
  baci-domain-event-router \
  'Baci durable domain-event router' \
  process-domain-events \
  process-domain-events.sh
install_service \
  baci-event-delivery-worker \
  'Baci durable event-delivery worker' \
  process-event-deliveries \
  process-event-deliveries.sh

CURRENT_USER="$(id -un)"
if [[ "$(loginctl show-user "$CURRENT_USER" -p Linger --value)" != 'yes' ]]; then
  loginctl enable-linger "$CURRENT_USER"
fi
if [[ "$(loginctl show-user "$CURRENT_USER" -p Linger --value)" != 'yes' ]]; then
  echo "User lingering is required for durable event workers" >&2
  exit 1
fi

systemctl --user daemon-reload
systemctl --user enable --now \
  baci-domain-event-router.service \
  baci-event-delivery-worker.service
