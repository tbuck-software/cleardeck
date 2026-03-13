#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

MODE="applications"
REQUESTED_PATH=""

if [[ "${1:-}" == "--out" ]]; then
  MODE="out"
  shift
fi

REQUESTED_PATH="${1:-}"

resolve_app_path() {
  local mode="${1}"
  local requested_path="${2:-}"
  local candidate=""

  if [[ -n "${requested_path}" ]]; then
    if [[ -d "${requested_path}" ]]; then
      printf '%s\n' "${requested_path}"
      return 0
    fi

    echo "App nicht gefunden: ${requested_path}" >&2
    return 1
  fi

  local candidates=()

  if [[ "${mode}" == "applications" ]]; then
    candidates=(
      "/Applications/ClearDeck.app"
      "/Applications/cleardeck.app"
    )
  else
    candidates=(
      "${REPO_ROOT}/out/ClearDeck-darwin-arm64/ClearDeck.app"
      "${REPO_ROOT}/out/ClearDeck-darwin-x64/ClearDeck.app"
      "${REPO_ROOT}/out/ClearDeck-darwin-universal/ClearDeck.app"
      "${REPO_ROOT}/out/cleardeck-darwin-arm64/cleardeck.app"
      "${REPO_ROOT}/out/cleardeck-darwin-x64/cleardeck.app"
      "${REPO_ROOT}/out/cleardeck-darwin-universal/cleardeck.app"
    )
  fi

  for candidate in "${candidates[@]}"; do
    if [[ -d "${candidate}" ]]; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  done

  if [[ "${mode}" == "out" ]]; then
    candidate="$(find "${REPO_ROOT}/out" -maxdepth 3 -type d -name '*.app' 2>/dev/null | head -n 1 || true)"
    if [[ -n "${candidate}" ]]; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  fi

  if [[ "${mode}" == "applications" ]]; then
    echo "Keine App unter /Applications gefunden. Nutze z. B. 'make allow APP=/Applications/ClearDeck.app'." >&2
  else
    echo "Keine App unter out/ gefunden. Nutze z. B. 'make allow-out APP=${REPO_ROOT}/out/ClearDeck-darwin-arm64/ClearDeck.app'." >&2
  fi

  return 1
}

APP_PATH="$(resolve_app_path "${MODE}" "${REQUESTED_PATH}")"

echo "Erlaube App: ${APP_PATH}"

# Remove Gatekeeper quarantine recursively from the bundle.
xattr -rd com.apple.quarantine "${APP_PATH}" 2>/dev/null || true

# Best-effort local allow entry for Gatekeeper.
spctl --add --label ClearDeck "${APP_PATH}" >/dev/null 2>&1 || true

echo "Fertig. Zum Starten:"
echo "open \"${APP_PATH}\""
