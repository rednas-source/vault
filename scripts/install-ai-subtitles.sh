#!/usr/bin/env bash
set -euo pipefail

VAULT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"
VENV_DIR="$VAULT_DIR/.venv"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "python3 is required. Install it, then run this script again." >&2
  exit 1
fi

if ! "$PYTHON_BIN" -m venv "$VENV_DIR" 2>/dev/null; then
  if command -v apt-get >/dev/null 2>&1 && [ "$(id -u)" -eq 0 ]; then
    apt-get update
    apt-get install -y python3-venv
    "$PYTHON_BIN" -m venv "$VENV_DIR"
  else
    echo "Python venv support is missing. Install python3-venv, then run this script again." >&2
    exit 1
  fi
fi

"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/python" -m pip install -r "$VAULT_DIR/scripts/requirements-ai.txt"
"$VENV_DIR/bin/python" -c 'import faster_whisper, importlib.metadata as m; print("faster-whisper", m.version("faster-whisper"), "ready")'

echo
echo "AI subtitles are installed in $VENV_DIR"
echo "Restart Vault: sudo systemctl restart vault.service"
echo "Then confirm /api/health reports aiSubtitles: true"
