# ClockIt
## Inspired by Clockify and used to practice Angular, Node and PostgreSQL code.

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

## Admin access in development

If you already have a user but no admin account, promote the intended account directly in your development database. Connect with the database user and database name configured for your environment:

```powershell
psql -U YOUR_DB_USER -d YOUR_DB_NAME
```

Replace `YOUR_DB_USER` and `YOUR_DB_NAME` with your PostgreSQL credentials. If PowerShell cannot find `psql`, add PostgreSQL's `bin` directory to `PATH` or run the executable by its local installation path:

```powershell
$psql = 'C:\path\to\PostgreSQL\bin\psql.exe'
& $psql -U YOUR_DB_USER -d YOUR_DB_NAME
```

Replace the example path with the location of `psql.exe` on your machine. At the `psql` prompt, run this SQL, replacing the example email with the existing user's email:

```sql
UPDATE users
SET role = 'admin'
WHERE email = LOWER(TRIM('you@example.com'));
```

PostgreSQL reports `UPDATE 1` when it found and promoted the account. `UPDATE 0` means no user has that email. This only changes the selected account's role; it does not reset its password. When the backend starts with users but no admins, it also automatically promotes the oldest account. If the database has no users yet, the first account can be created through the unauthenticated `POST /api/users` bootstrap endpoint, which makes that account an admin. See [backend/README.md](./backend/README.md#roles-and-user-management) for details.

## Configuration

- `backend/.env` — runtime configuration for the API (PostgreSQL connection, JWT secret, CORS origin, port). Copy `backend/.env.example` to create your own; `.env` files are git-ignored.
- `frontend/src/environments/` — build-time configuration for the Angular app (API base URL per environment).
- Root [.gitignore](./.gitignore) — ignores `node_modules`, build output, `.env*` files (except `.env.example`), and editor/OS artifacts for both apps.
