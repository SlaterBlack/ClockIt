# Clockify Dupe

A time recording system scaffold similar to Clockify, with an Angular frontend and a Node/Express/TypeScript backend.

## Structure

```
frontend/   Angular app (standalone components, custom CSS design system, JWT auth wiring)
backend/    Express + TypeScript API (Sequelize/PostgreSQL, JWT auth, workspaces/projects/time entries)
```

See [frontend/README.md](./frontend/README.md) and [backend/README.md](./backend/README.md) for details on each app.

## Quick start

1. **Backend**
   ```powershell
   cd backend
   npm install
   # review/update backend/.env (DB connection, JWT secret, etc.)
   npm run dev
   ```
   Requires a running PostgreSQL instance matching the `DB_*` values in `backend/.env`.

2. **Frontend**
   ```powershell
   cd frontend
   npm install
   npm start
   ```
   Opens at `http://localhost:4200` and talks to the API at `http://localhost:4000/api` by default.

## Configuration

- `backend/.env` — runtime configuration for the API (PostgreSQL connection, JWT secret, CORS origin, port). Copy `backend/.env.example` to create your own; `.env` files are git-ignored.
- `frontend/src/environments/` — build-time configuration for the Angular app (API base URL per environment).
- Root [.gitignore](./.gitignore) — ignores `node_modules`, build output, `.env*` files (except `.env.example`), and editor/OS artifacts for both apps.
