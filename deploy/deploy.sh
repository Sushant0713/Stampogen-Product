#!/usr/bin/env bash
# Stampogen VPS deploy helper (run from repo root on the server).
# Usage:
#   chmod +x deploy/deploy.sh
#   DOMAIN=stampogen.example.com ./deploy/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="${DOMAIN:-stampogen.example.com}"
API_PORT="${API_PORT:-5001}"
WEB_PORT="${WEB_PORT:-3001}"

echo "==> Stampogen deploy"
echo "    root:   $ROOT"
echo "    domain: $DOMAIN"
echo "    ports:  web=$WEB_PORT api=$API_PORT"

if [[ ! -f "$ROOT/backend/.env" ]]; then
  echo "==> Creating backend/.env from production example"
  sed "s/stampogen.example.com/$DOMAIN/g" \
    "$ROOT/deploy/backend.env.production.example" > "$ROOT/backend/.env"
  echo "    EDIT backend/.env — set JWT secrets, Mongo, SMTP, Google, Razorpay"
fi

if [[ ! -f "$ROOT/frontend/.env.local" ]]; then
  echo "==> Creating frontend/.env.local from production example"
  sed "s/stampogen.example.com/$DOMAIN/g; s/5001/$API_PORT/g" \
    "$ROOT/deploy/frontend.env.production.example" > "$ROOT/frontend/.env.local"
  echo "    EDIT frontend/.env.local — set Google client id if needed"
fi

# Keep PORT in sync if user overrides
if grep -q '^PORT=' "$ROOT/backend/.env"; then
  sed -i.bak "s/^PORT=.*/PORT=$API_PORT/" "$ROOT/backend/.env" && rm -f "$ROOT/backend/.env.bak"
fi
if grep -q '^BACKEND_URL=' "$ROOT/frontend/.env.local"; then
  sed -i.bak "s|^BACKEND_URL=.*|BACKEND_URL=http://127.0.0.1:$API_PORT|" "$ROOT/frontend/.env.local" && rm -f "$ROOT/frontend/.env.local.bak"
fi

echo "==> Installing backend dependencies"
cd "$ROOT/backend"
npm ci --omit=dev

echo "==> Seeding system roles (safe to re-run)"
npm run seed || true

echo "==> Installing frontend dependencies + build"
cd "$ROOT/frontend"
npm ci
npm run build

echo "==> Starting / restarting PM2 apps"
cd "$ROOT"
if command -v pm2 >/dev/null 2>&1; then
  # Patch ecosystem ports if custom
  TMP_ECO="$ROOT/deploy/.ecosystem.runtime.cjs"
  sed "s/PORT: 5001/PORT: $API_PORT/g; s/-p 3001/-p $WEB_PORT/g; s/PORT: 3001/PORT: $WEB_PORT/g" \
    "$ROOT/deploy/ecosystem.config.cjs" > "$TMP_ECO"
  pm2 startOrReload "$TMP_ECO" --update-env
  pm2 save
  echo "==> PM2 status"
  pm2 status
else
  echo "    pm2 not found — install with: sudo npm i -g pm2"
  echo "    then: pm2 start deploy/ecosystem.config.cjs && pm2 save"
fi

echo ""
echo "==> Next steps"
echo "    1. Fill secrets in backend/.env and frontend/.env.local"
echo "    2. Install Nginx site: sudo cp deploy/nginx.stampogen.conf /etc/nginx/sites-available/stampogen"
echo "       (edit server_name to $DOMAIN)"
echo "    3. sudo ln -sf /etc/nginx/sites-available/stampogen /etc/nginx/sites-enabled/"
echo "    4. sudo nginx -t && sudo systemctl reload nginx"
echo "    5. sudo certbot --nginx -d $DOMAIN"
echo "    6. Health: curl -s http://127.0.0.1:$API_PORT/api/v1/health"
echo "    7. Site:   curl -I http://127.0.0.1:$WEB_PORT"
echo "Done."
