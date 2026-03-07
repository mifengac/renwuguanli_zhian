#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-scan}"
BASE_URL="${MONITOR_JOB_BASE_URL:-http://127.0.0.1:3000}"
JOB_TOKEN="${MONITOR_JOB_TOKEN:-}"

if [[ -z "$JOB_TOKEN" ]]; then
  echo "MONITOR_JOB_TOKEN is required" >&2
  exit 1
fi

case "$ACTION" in
  generate|scan|retry)
    ;;
  *)
    echo "Unsupported action: $ACTION" >&2
    echo "Usage: $0 {generate|scan|retry}" >&2
    exit 1
    ;;
esac

curl --fail --silent --show-error \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-monitor-job-token: ${JOB_TOKEN}" \
  -d '{}' \
  "${BASE_URL}/api/monitor/jobs/${ACTION}"
