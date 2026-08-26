#!/bin/sh
set -eu

REPO="${VAULT_REPO:-/root/vault}"
BRANCH="${VAULT_DEPLOY_BRANCH:-production}"
SERVICE="${VAULT_SERVICE:-vault.service}"
HEALTH="${VAULT_HEALTH_URL:-http://127.0.0.1:8420/api/health}"
LOCK_FILE="${VAULT_UPDATE_LOCK:-/run/lock/vault-update.lock}"

if [ ! -d "$REPO/.git" ]; then
  echo "Vault Git checkout not found: $REPO" >&2
  exit 1
fi

for command in git npm node systemctl curl flock; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command not found: $command" >&2
    exit 1
  fi
done

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another Vault update is already running."
  exit 0
fi

if ! git -C "$REPO" diff --quiet --ignore-submodules -- || \
   ! git -C "$REPO" diff --cached --quiet --ignore-submodules --; then
  echo "Vault has tracked local changes; refusing to overwrite them." >&2
  exit 1
fi

old_commit="$(git -C "$REPO" rev-parse HEAD)"
echo "Checking origin/$BRANCH for a verified Vault release..."
git -C "$REPO" fetch --prune origin "$BRANCH"
new_commit="$(git -C "$REPO" rev-parse "origin/$BRANCH")"

if [ "$old_commit" = "$new_commit" ]; then
  echo "Vault is already running the latest verified commit."
  exit 0
fi

if ! git -C "$REPO" merge-base --is-ancestor "$old_commit" "$new_commit"; then
  echo "origin/$BRANCH is not a fast-forward from $old_commit; refusing the update." >&2
  exit 1
fi

install_dependencies() {
  if [ -f "$REPO/package-lock.json" ]; then
    (cd "$REPO" && npm ci --omit=dev)
  else
    (cd "$REPO" && npm install --omit=dev)
  fi
}

healthy() {
  response="$(curl -fsS --max-time 5 "$HEALTH" 2>/dev/null || true)"
  printf '%s' "$response" | grep -q '"ok":true'
}

wait_for_health() {
  attempt=0
  while [ "$attempt" -lt 45 ]; do
    if healthy; then return 0; fi
    attempt=$((attempt + 1))
    sleep 2
  done
  return 1
}

rollback() {
  echo "Rolling Vault back to $old_commit..." >&2
  git -C "$REPO" reset --hard "$old_commit"
  install_dependencies
  systemctl restart "$SERVICE"
  if ! wait_for_health; then
    echo "Rollback also failed. Recent Vault logs:" >&2
    journalctl -u "$SERVICE" -n 100 --no-pager >&2 || true
  fi
}

echo "Deploying $new_commit..."
git -C "$REPO" pull --ff-only origin "$BRANCH"

if ! install_dependencies || ! node --check "$REPO/server.js"; then
  echo "Dependency install or syntax check failed." >&2
  rollback
  exit 1
fi

systemctl restart "$SERVICE"
if wait_for_health; then
  echo "Vault is healthy and running $new_commit."
  exit 0
fi

echo "The new Vault release did not become healthy. Recent logs:" >&2
journalctl -u "$SERVICE" -n 100 --no-pager >&2 || true
rollback
exit 1

