# Stampogen Backend API

Multi-tenant SaaS platform API built with Node.js, Express, and MongoDB.

## Stack

- Node.js + Express.js
- MongoDB + Mongoose
- JWT Access & Refresh Tokens (HTTP-only cookies)
- Passport Google OAuth 2.0
- Helmet, CORS, Rate Limiting
- express-validator

## Getting Started

```bash
cp .env.example .env
npm install
npm run seed
npm run dev
```

API runs at `http://localhost:5000`

## Architecture

```
src/
├── config/          # App & Passport configuration
├── database/        # DB connection & seeders
├── models/          # Mongoose schemas
├── repositories/    # Data access layer
├── services/        # Business logic
├── controllers/     # HTTP handlers
├── routes/          # API routes
├── middlewares/     # Auth, validation, errors
├── validators/      # Request validation
├── modules/         # Feature modules (auth, tenant, user, role)
├── utils/           # Shared utilities
├── helpers/         # Helper functions
├── constants/       # App constants
├── jobs/            # Background jobs (placeholder)
└── socket/          # WebSocket (placeholder)
```

## API Endpoints

Base URL: `/api/v1`

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register/:role` | Register (super-admin, admin, affiliate) |
| POST | `/auth/login/:role` | Login |
| POST | `/auth/refresh` | Refresh tokens |
| POST | `/auth/logout` | Logout |
| GET | `/auth/me` | Current user |
| GET | `/auth/google/:role` | Google OAuth start |
| GET | `/auth/google/callback` | Google OAuth callback |

### Roles

| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/roles` | Super Admin |
| GET | `/roles/:id` | Super Admin |

### Tenants

| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/tenants` | Super Admin |
| GET | `/tenants` | Super Admin |
| GET | `/tenants/:id` | Super Admin / Admin |
| PATCH | `/tenants/:id` | Super Admin |
| DELETE | `/tenants/:id` | Super Admin |

### Users

| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/users` | Super Admin / Admin |
| GET | `/users/:id` | Super Admin / Admin |
| PATCH | `/users/:id` | Super Admin / Admin |

## Roles

- `super-admin` — Platform owner
- `admin` — Tenant owner
- `affiliate` — Affiliate partner
- `user` — Reserved (not authenticated in this version)

## Environment

See `.env.example` for all required variables.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon |
| `npm start` | Production start |
| `npm run seed` | Seed default roles |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
