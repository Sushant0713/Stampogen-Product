#!/usr/bin/env bash
# Quick Docker deploy helper (run from repo root on the VPS).
# Usage:
#   chmod +x deploy/docker-up.sh
#   DOMAIN=stampogen.example.com ./deploy/docker-up.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="${DOMAIN:-stampogen.example.com}"
PORT="${STAMPOGEN_HTTP_PORT:-3081}"

cd "$ROOT"

if [[ ! -f .env.docker ]]; then
  echo "==> Creating .env.docker"
  sed "s/stampogen.example.com/$DOMAIN/g" deploy/docker.env.example > .env.docker
  echo "    EDIT .env.docker — set JWT secrets, Google, SMTP, Razorpay"
fi

if [[ ! -f .env ]]; then
  echo "==> Creating .env for compose build args"
  cat > .env <<EOF
NEXT_PUBLIC_APP_URL=https://${DOMAIN}
NEXT_PUBLIC_MARKETING_URL=https://${MARKETING_DOMAIN:-stampogen.in}
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
STAMPOGEN_HTTP_PORT=${PORT}
STAMPOGEN_HTTP_BIND=127.0.0.1
EOF
fi

echo "==> Building and starting containers"
docker compose up -d --build

echo "==> Status"
docker compose ps

echo ""
echo "Stack listening on http://127.0.0.1:${PORT}"
echo "Point host Nginx at it (deploy/nginx.docker-host.conf), then:"
echo "  sudo certbot --nginx -d ${DOMAIN}"
echo "Health: curl -s http://127.0.0.1:5001/api/v1/health"
