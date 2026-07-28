# Stampogen — Multi-Tenant SaaS Platform

Production-ready starter for a multi-tenant SaaS platform with role-based authentication.

## Projects

```
Stampogen/
├── frontend/    # Next.js 15 App Router
└── backend/     # Express + MongoDB API
```

## Roles

| Role | Portal | Status |
|------|--------|--------|
| Super Admin | `/super-admin/*` | Implemented |
| Admin | `/admin/*` | Implemented |
| Affiliate | `/affiliate/*` | Implemented |
| User | — | Reserved for future |

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run seed
npm run dev
```

API: `http://localhost:5000`

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

App: `http://localhost:3000`

### 3. MongoDB

Ensure MongoDB is running locally, or update `MONGODB_URI` in backend `.env`.

### 4. Google OAuth (optional)

1. Create credentials in [Google Cloud Console](https://console.cloud.google.com/)
2. Set authorized redirect URI to:
   `http://localhost:5000/api/v1/auth/google/callback`
3. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to backend `.env`

## Root Page

`http://localhost:3000` shows only:

- Admin Login
- Admin Register

## Architecture Highlights

- Clean architecture (controllers → services → repositories → models)
- JWT access + refresh tokens in HTTP-only cookies
- Token rotation on refresh
- Passport Google OAuth for Super Admin, Admin, Affiliate
- Multi-tenant data model (Tenant ↔ Admin owner)
- Role-based route protection (frontend + backend)
- Collapsible role-based dashboard sidebars
- Tailwind design system (primary `#021A54`)

## Tech Stack

**Frontend:** Next.js 15, Tailwind CSS, Axios, React Hook Form, Zod, React Hot Toast, Lucide React

**Backend:** Node.js, Express, MongoDB, Mongoose, JWT, Passport Google OAuth, Helmet, CORS, Rate Limiting

## Documentation

- [Frontend README](./frontend/README.md)
- [Backend README](./backend/README.md)
