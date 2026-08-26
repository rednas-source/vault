#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this installer as root (or with sudo)." >&2
  exit 1
fi

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

install -o root -g root -m 0750 \
  "$SCRIPT_DIR/update-production.sh" \
  /usr/local/sbin/vault-update

install -o root -g root -m 0644 \
  "$SCRIPT_DIR/vault-update.service" \
  /etc/systemd/system/vault-update.service

install -o root -g root -m 0644 \
  "$SCRIPT_DIR/vault-update.timer" \
  /etc/systemd/system/vault-update.timer

systemctl daemon-reload
systemctl enable --now vault-update.timer

echo "Vault auto-update is installed. Running the first verified-release check now..."
systemctl start vault-update.service
systemctl --no-pager --full status vault-update.timer || true
systemctl --no-pager --full status vault-update.service || true

