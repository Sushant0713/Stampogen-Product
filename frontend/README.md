# Stampogen Frontend

Multi-tenant SaaS frontend built with Next.js 15 (App Router).

## Stack

- Next.js 15 (App Router)
- JavaScript
- Tailwind CSS
- Axios
- React Hook Form + Zod
- React Hot Toast
- Lucide React
- React Context API

## Getting Started

```bash
cp .env.example .env.local
npm install
npm run dev
```

App runs at `http://localhost:3000`

## Routes

| Path | Description |
|------|-------------|
| `/` | Admin Login & Register entry |
| `/admin/login` | Admin login |
| `/admin/register` | Admin register |
| `/admin/dashboard` | Admin dashboard |
| `/super-admin/login` | Super Admin login |
| `/super-admin/register` | Super Admin register |
| `/super-admin/dashboard` | Super Admin dashboard |
| `/affiliate/login` | Affiliate login |
| `/affiliate/register` | Affiliate register |
| `/affiliate/dashboard` | Affiliate dashboard |

User role routes are intentionally not included.

## Architecture

```
src/
├── app/                 # Next.js App Router pages
├── components/          # Reusable UI (layout, sidebar, forms, etc.)
├── features/            # Feature modules by role
├── contexts/            # Auth, User, Tenant providers
├── hooks/               # Custom React hooks
├── services/            # API service layer
├── lib/                 # Axios client, validations
├── middleware/          # Auth helpers
├── constants/           # App constants
├── utils/               # Utilities
└── styles/              # Global CSS & design system
```

## Theme

| Token | Value |
|-------|-------|
| Primary | `#021A54` |
| Background | `#FFFFFF` |
| Text | `#000000` |

## Environment

See `.env.example`. Copy to `.env.local` for local development.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
