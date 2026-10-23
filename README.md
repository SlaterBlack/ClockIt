# ClockIt
## Inspired by Clockify and used to practice Angular, Node and PostgreSQL code.

A time recording app with an Angular frontend. Its API and PostgreSQL data are
being consolidated into the shared StoreIt Node/Express service.

## Structure

```
frontend/   Angular app (standalone components, custom CSS design system, JWT auth wiring)
backend/    Legacy API source retained until StoreIt migration is verified
```

See [frontend/README.md](./frontend/README.md) and [backend/README.md](./backend/README.md) for details on each app.

## Quick start

1. **Shared API**
   Configure and run the StoreIt backend. See [StoreIt setup](../StoreIt/README.md).
   ```powershell
   Set-Location ..\StoreIt\backend
   npm install
   npm run db:migrate
   npm run dev
   ```
   StoreIt serves `/api/clockit/...` and shared authentication on port 4002.

2. **Frontend**
   ```powershell
   cd frontend
   npm install
   npm start
   ```
   The frontend development proxy sends API calls to StoreIt.

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

- `../StoreIt/backend/.env` — runtime configuration for the shared API and PostgreSQL database.
- `frontend/src/environments/` — build-time configuration for the Angular app (API base URL per environment).
- Root [.gitignore](./.gitignore) — ignores `node_modules`, build output, `.env*` files (except `.env.example`), and editor/OS artifacts for both apps.

The legacy ClockIt backend directory is intentionally retained as a rollback
reference. Do not remove it until the StoreIt data import and frontend
verification are complete.
