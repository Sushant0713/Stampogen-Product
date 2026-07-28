# Stampogen — Deploy with GitHub + CI/CD (same VPS as Invogen)

Use this guide on your PC / in GitHub.  
After each deploy, the server script **removes `DEPLOY.md` from the VPS** so it does not stay there.

Your VPS already runs **Invogen**. Stampogen is a second Docker stack.

| Invogen (keep) | Stampogen (new) |
|----------------|-----------------|
| ports `3000`, `5000`, `127.0.0.1:3080` | `127.0.0.1:3081`, debug API `5001` |
| Nginx site `invogen` | Nginx site `stampogen` (new file only) |
| containers `invogen-*` | containers `stampogen-*` |
| folder (leave alone) | `/var/www/stampogen` |

Replace:

- `YOUR_GITHUB_USER` — your GitHub username/org  
- `YOUR_DOMAIN.com` — Stampogen domain  
- `YOUR_VPS_IP` — same IP as Invogen  

---

## Overview

```text
PC  →  git push  →  GitHub (main)
                      ↓
              GitHub Actions
                      ↓
              SSH into VPS
                      ↓
         git pull + docker compose up
                      ↓
              Invogen stays running
```

**One-time on VPS:** clone repo + create `.env` / `.env.docker` + Nginx + SSL.  
**Every later change:** `git push origin main` → auto deploy.

---

## Part A — Create GitHub repository

### A1. Create repo on GitHub

1. GitHub → **New repository**  
2. Name example: `Stampogen`  
3. Private recommended  
4. Do **not** add README if you already have local code  

### A2. Push code from your PC

In PowerShell (`E:\Stampogen`):

```powershell
cd E:\Stampogen
git init
git add .
git commit -m "Initial Stampogen with Docker and GitHub Actions"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USER/Stampogen.git
git push -u origin main
```

Confirm on GitHub that these exist:

- `docker-compose.yml`
- `.github/workflows/deploy.yml`
- `deploy/vps-update.sh`
- `backend/`, `frontend/`, `docker/`

Secrets (`.env`, `.env.docker`) must **not** be in the repo (they are gitignored).

---

## Part B — SSH key for GitHub Actions → VPS

On your **PC** (or VPS), create a deploy key used only for CI:

```bash
ssh-keygen -t ed25519 -C "stampogen-github-actions" -f stampogen_gha -N ""
```

This creates:

- `stampogen_gha` — **private** key → GitHub Actions secret  
- `stampogen_gha.pub` — **public** key → VPS `authorized_keys`  

### B1. Add public key on VPS

```bash
# on VPS as the deploy user (often root)
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "PASTE_CONTENTS_OF_stampogen_gha.pub" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### B2. Add GitHub Actions secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret name | Value |
|-------------|--------|
| `VPS_HOST` | `YOUR_VPS_IP` (or hostname) |
| `VPS_USERNAME` | `root` (or your SSH user) |
| `VPS_SSH_PRIVATE_KEY` | Full contents of private file `stampogen_gha` |
| `VPS_PORT` | `22` (**required** — use `22` unless you changed SSH port) |
| `DEPLOY_PATH` | `/var/www/stampogen` |

Delete local key files after saving secrets if you want (`stampogen_gha` / `.pub`).

---

## Part C — Allow VPS to `git pull` from GitHub

If the repo is **private**, the VPS needs read access.

### Option 1 — Deploy key (recommended)

1. On VPS:

```bash
ssh-keygen -t ed25519 -C "stampogen-vps-read" -f ~/.ssh/stampogen_github -N ""
cat ~/.ssh/stampogen_github.pub
```

2. GitHub repo → **Settings** → **Deploy keys** → **Add deploy key**  
   - Title: `stampogen-vps`  
   - Key: paste the `.pub` contents  
   - Allow write access: **No** (read-only)  

3. On VPS, force git to use that key for GitHub:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/stampogen_github
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
```

---

## Part D — First-time setup on VPS (once only)

### D1. Clone

```bash
sudo mkdir -p /var/www/stampogen
sudo chown -R $USER:$USER /var/www/stampogen
cd /var/www
git clone git@github.com:YOUR_GITHUB_USER/Stampogen.git stampogen
cd /var/www/stampogen
rm -f DEPLOY.md
```

### D2. Create `.env.docker` (API secrets — never commit)

```bash
cd /var/www/stampogen
nano .env.docker
```

```env
NODE_ENV=production

JWT_ACCESS_SECRET=PASTE_LONG_RANDOM_SECRET_1
JWT_REFRESH_SECRET=PASTE_LONG_RANDOM_SECRET_2
JWT_ACCESS_EXPIRES_IN=365d
JWT_REFRESH_EXPIRES_IN=3650d

COOKIE_SECURE=true
COOKIE_SAME_SITE=lax

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://YOUR_DOMAIN.com/api/v1/auth/google/callback

SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Stampogen <noreply@YOUR_DOMAIN.com>

OTP_EXPIRES_MINUTES=10
OTP_MAX_ATTEMPTS=5

FRONTEND_URL=https://YOUR_DOMAIN.com
CORS_ORIGIN=https://YOUR_DOMAIN.com

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1000
AUTH_RATE_LIMIT_MAX=100
```

```bash
openssl rand -hex 32
openssl rand -hex 32
```

### D3. Create `.env` (port **3081** — 3080 is Invogen marketing)

```bash
nano .env
```

```env
NEXT_PUBLIC_APP_URL=https://app.blueorbitservice.space
NEXT_PUBLIC_GOOGLE_CLIENT_ID=1098413752599-8r61a49ffm0e8g2u0ltbabmdd4eiorb9.apps.googleusercontent.com
STAMPOGEN_HTTP_PORT=3081
STAMPOGEN_HTTP_BIND=127.0.0.1
```

### D4. First build manually

```bash
cd /var/www/stampogen
chmod +x deploy/vps-update.sh
bash deploy/vps-update.sh
```

Check Invogen still running:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}'
# invogen-* and stampogen-* should both be Up
```

```bash
curl -s http://127.0.0.1:5001/api/v1/health
curl -I http://127.0.0.1:3081
```

### D5. DNS

A record: `YOUR_DOMAIN.com` → same VPS IP as Invogen.

### D6. Nginx — new site only (do not edit `invogen`)

```bash
ls /etc/nginx/sites-enabled/
sudo nano /etc/nginx/sites-available/stampogen
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name app.blueorbitservice.space;

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

```bash
sudo ln -sf /etc/nginx/sites-available/stampogen /etc/nginx/sites-enabled/stampogen
sudo nginx -t && sudo systemctl reload nginx
```

### D7. SSL

```bash
sudo certbot --nginx -d YOUR_DOMAIN.com
```

Open `https://YOUR_DOMAIN.com` and confirm Invogen still works.

---

## Part E — CI/CD: every push deploys

Workflow file (already in repo):

`.github/workflows/deploy.yml`

It runs on:

- push to `main`
- manual **Run workflow** (Actions tab)

What it does on the VPS:

1. `cd /var/www/stampogen`  
2. `bash deploy/vps-update.sh`  
3. `git fetch` + `reset --hard origin/main`  
4. `rm -f DEPLOY.md`  
5. `docker compose up -d --build`  

### E1. Trigger a deploy

On PC:

```powershell
cd E:\Stampogen
# make a small change, then:
git add .
git commit -m "Trigger deploy"
git push origin main
```

### E2. Watch the pipeline

GitHub → **Actions** → **Deploy Stampogen to VPS** → open the run → check logs.

### E3. Manual re-run

Actions → select workflow → **Run workflow**.

---

## Part F — Day-to-day workflow

```text
1. Code on PC
2. git add / commit / push main
3. Wait for green Actions check
4. Site updates on https://YOUR_DOMAIN.com
```

Emergency update on VPS without GitHub:

```bash
cd /var/www/stampogen
bash deploy/vps-update.sh
```

Stop Stampogen only (Invogen stays up):

```bash
cd /var/www/stampogen
docker compose down
```

---

## Do not do

- Do not stop `invogen-*` containers  
- Do not edit Nginx site `invogen`  
- Do not commit `.env` or `.env.docker`  
- Do not use host ports `3000`, `5000`, or `3080` for Stampogen  
- Do not leave production secrets in GitHub code  

---

## Troubleshooting CI/CD

| Problem | Fix |
|---------|-----|
| Actions: Permission denied (SSH) | Check `VPS_SSH_PRIVATE_KEY` and `authorized_keys` |
| Actions: Repository not found on VPS | Fix deploy key / `~/.ssh/config` for `github.com` |
| Actions: `.env.docker missing` | Create env files once on VPS (Part D) |
| Build fails in compose | `docker compose logs` on VPS |
| Site 502 | `curl -I http://127.0.0.1:3081` and `docker compose ps` |
| Invogen broken | You edited wrong Nginx file or stopped wrong containers — restore `invogen` site |

---

## Checklist

**GitHub**

1. Repo created and code pushed  
2. Actions secrets set (`VPS_HOST`, `VPS_USERNAME`, `VPS_SSH_PRIVATE_KEY`, `DEPLOY_PATH`)  
3. Workflow file present  

**VPS (once)**

4. Repo cloned to `/var/www/stampogen`  
5. Deploy key for private repo (if needed)  
6. `.env` + `.env.docker` created (`3081`)  
7. First `bash deploy/vps-update.sh` OK  
8. Nginx `stampogen` → `127.0.0.1:3081`  
9. Certbot done  
10. Invogen still healthy  

**Ongoing**

11. `git push origin main` → Actions deploys  

Done.
