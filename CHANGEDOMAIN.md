# Stampogen — Change Domain

Use this when Stampogen already runs on the VPS (same stack as `DEPLOY.md`) and you only need to move to a new domain.

**Do not touch Invogen** (`invogen-*` containers, Nginx site `invogen`, ports `3000` / `5000` / `3080`).

Replace:

- `OLD_DOMAIN` — current Stampogen domain (today: `app.blueorbitservice.space`)
- `NEW_DOMAIN` — new Stampogen domain (example: `stampogen.yourbrand.com`)
- `YOUR_VPS_IP` — same VPS IP as Invogen

Paths (from `DEPLOY.md`):

| Item | Value |
|------|--------|
| App folder | `/var/www/stampogen` |
| Frontend env | `/var/www/stampogen/.env` |
| Backend env | `/var/www/stampogen/.env.docker` |
| Nginx site | `/etc/nginx/sites-available/stampogen` |
| App port | `127.0.0.1:3081` |
| API debug | `5001` |

---

## Overview

```text
1. DNS A record for NEW_DOMAIN → VPS
2. Update .env + .env.docker on VPS
3. Update Nginx server_name
4. SSL (certbot) for NEW_DOMAIN
5. Rebuild Stampogen containers (NEXT_PUBLIC_* is bake-time)
6. Update Google OAuth / SMTP if used
7. Verify https://NEW_DOMAIN and that Invogen still works
```

---

## Step 1 — DNS

Create an **A record**:

```text
NEW_DOMAIN  →  YOUR_VPS_IP
```

Wait until it resolves:

```bash
dig +short NEW_DOMAIN
# should show YOUR_VPS_IP
```

Keep `OLD_DOMAIN` pointing at the VPS until you finish cutover (optional).

---

## Step 2 — Backend env (`.env.docker`)

```bash
cd /var/www/stampogen
nano .env.docker
```

Change every place that uses the old domain:

```env
GOOGLE_CALLBACK_URL=https://NEW_DOMAIN/api/v1/auth/google/callback

SMTP_FROM=Stampogen <noreply@NEW_DOMAIN>

FRONTEND_URL=https://NEW_DOMAIN
CORS_ORIGIN=https://NEW_DOMAIN
```

Leave JWT secrets, Mongo, Razorpay, etc. unchanged unless you intentionally rotate them.

**Do not commit** `.env.docker`.

---

## Step 3 — Frontend env (`.env`)

```bash
cd /var/www/stampogen
nano .env
```

Change:

```env
NEXT_PUBLIC_APP_URL=https://NEW_DOMAIN
NEXT_PUBLIC_MARKETING_URL=https://MARKETING_DOMAIN
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...same or updated...
STAMPOGEN_HTTP_PORT=3081
STAMPOGEN_HTTP_BIND=127.0.0.1
```

Example (current production):

```env
NEXT_PUBLIC_APP_URL=https://app.stampogen.in
NEXT_PUBLIC_MARKETING_URL=https://stampogen.in
```

These control:

| Env | Used for |
|-----|----------|
| `NEXT_PUBLIC_APP_URL` | Login as shop owner, loyalty QR `/join/{slug}`, emails/backend `FRONTEND_URL` should match |
| `NEXT_PUBLIC_MARKETING_URL` | Pricing nav: Home, About us, Affiliate Program |

`NEXT_PUBLIC_*` values are baked into the frontend image at build time — you **must rebuild** after this change (Step 5).

**Do not commit** `.env`.

---

## Step 4 — Nginx (`stampogen` site only)

```bash
sudo nano /etc/nginx/sites-available/stampogen
```

Set `server_name` to the new domain (and keep proxy to `3081` as in `DEPLOY.md`):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name NEW_DOMAIN;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }
}
```

Test and reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

**Do not edit** the `invogen` Nginx site.

---

## Step 5 — Rebuild Stampogen

Env changes for `NEXT_PUBLIC_*` need a rebuild:

```bash
cd /var/www/stampogen
bash deploy/vps-update.sh
```

Or only compose rebuild:

```bash
cd /var/www/stampogen
docker compose up -d --build
```

Confirm containers:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}'
# invogen-* and stampogen-* should both be Up
```

Health checks:

```bash
curl -s http://127.0.0.1:5001/api/v1/health
curl -I http://127.0.0.1:3081
```

---

## Step 6 — SSL for the new domain

```bash
sudo certbot --nginx -d NEW_DOMAIN
```

Open:

- `https://NEW_DOMAIN`
- Invogen URL (confirm it still works)

Optional — remove old cert later (only after cutover is done):

```bash
sudo certbot delete --cert-name OLD_DOMAIN
```

---

## Step 7 — Google OAuth (if used)

In Google Cloud Console → OAuth client:

| Setting | New value |
|---------|-----------|
| Authorized JavaScript origins | `https://NEW_DOMAIN` |
| Authorized redirect URIs | `https://NEW_DOMAIN/api/v1/auth/google/callback` |

Match `GOOGLE_CALLBACK_URL` in `.env.docker` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `.env`.

---

## Step 8 — SMTP / email (if used)

If mail uses the domain:

- Update DNS for mail (SPF / DKIM / MX) for `NEW_DOMAIN`
- Keep `SMTP_*` host/user/pass as needed
- Ensure `SMTP_FROM` uses `@NEW_DOMAIN` (or your real sending domain)

---

## Step 9 — Optional: CI/CD docs / examples in repo

VPS secrets in GitHub Actions (`VPS_HOST`, etc.) do **not** need changing for a domain swap.

If you keep example env files in the repo for documentation, update placeholders later:

- `deploy/backend.env.production.example` → `FRONTEND_URL`, `CORS_ORIGIN`, `GOOGLE_CALLBACK_URL`, `SMTP_FROM`
- `deploy/frontend.env.production.example` → `NEXT_PUBLIC_APP_URL`
- `deploy/docker.env.example` → same domain fields
- `DEPLOY.md` examples that hardcode `app.blueorbitservice.space`

These do not affect the live site until you change the real `.env` / `.env.docker` on the VPS.

---

## Cutover checklist

1. DNS A record for `NEW_DOMAIN` → VPS  
2. `.env.docker`: `FRONTEND_URL`, `CORS_ORIGIN`, `GOOGLE_CALLBACK_URL`, `SMTP_FROM`  
3. `.env`: `NEXT_PUBLIC_APP_URL` + `NEXT_PUBLIC_MARKETING_URL`  
4. Nginx `server_name NEW_DOMAIN` → `127.0.0.1:3081`  
5. `bash deploy/vps-update.sh` (or `docker compose up -d --build`)  
6. `certbot --nginx -d NEW_DOMAIN`  
7. Google OAuth origins / callback updated  
8. Open `https://NEW_DOMAIN` — login, loyalty join links, invoices look correct  
9. Confirm Invogen still healthy  
10. (Optional) Remove `OLD_DOMAIN` DNS + old SSL cert  

---

## Do not do

- Do not stop `invogen-*` containers  
- Do not edit Nginx site `invogen`  
- Do not commit `.env` or `.env.docker`  
- Do not change Stampogen to host ports `3000`, `5000`, or `3080`  
- Do not skip rebuild after changing `NEXT_PUBLIC_APP_URL`  

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Site 502 on new domain | `curl -I http://127.0.0.1:3081` and `docker compose ps` |
| Wrong domain in emails / QR / links | Check `FRONTEND_URL` and rebuild after `NEXT_PUBLIC_APP_URL` |
| CORS / cookie / login fails | Match `CORS_ORIGIN` + `FRONTEND_URL` to `https://NEW_DOMAIN` |
| Google login broken | Update Google Console + `GOOGLE_CALLBACK_URL` |
| Certbot fails | DNS not pointing yet — wait for A record |
| Invogen broken | You edited wrong Nginx file — restore `invogen` site |

---

## Emergency rollback

1. Point DNS of `OLD_DOMAIN` (if still valid) or set Nginx `server_name` back to `OLD_DOMAIN`  
2. Restore previous values in `.env` / `.env.docker`  
3. Rebuild: `bash deploy/vps-update.sh`  
4. `sudo nginx -t && sudo systemctl reload nginx`  

Done.
