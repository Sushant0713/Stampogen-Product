#!/usr/bin/env bash
# Run on the VPS by GitHub Actions (or manually).
# Usage (from /var/www/stampogen):
#   bash deploy/vps-update.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="${DEPLOY_BRANCH:-main}"

echo "==> Stampogen update in $ROOT (branch: $BRANCH)"

if [[ ! -f .env.docker ]]; then
  echo "ERROR: .env.docker missing. Create it once on the VPS before CI/CD deploys."
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "ERROR: .env missing. Create it once on the VPS (STAMPOGEN_HTTP_PORT=3081)."
  exit 1
fi

echo "==> Fetching $BRANCH"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# Guide is for humans / GitHub — not needed on the server
rm -f DEPLOY.md

echo "==> Building and restarting containers (Invogen untouched)"
docker compose up -d --build

echo "==> Pruning dangling images"
docker image prune -f >/dev/null 2>&1 || true

echo "==> Status"
docker compose ps

echo "==> Health"
curl -sf "http://127.0.0.1:5001/api/v1/health" && echo "" || echo "WARN: API health check failed (container may still be starting)"

echo "Done."
