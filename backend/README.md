# Backend — Clockify Dupe API

Node.js + Express + TypeScript REST API scaffold for the time recording system, using Sequelize with PostgreSQL and JWT-based authentication.

## Stack

- **Express** — HTTP server and routing
- **TypeScript** — static typing
- **Sequelize** + **pg** — PostgreSQL ORM
- **jsonwebtoken** / **bcryptjs** — authentication
- **helmet**, **cors**, **morgan** — security headers, CORS and request logging

## Project structure

```
src/
  config/        # env loading and Sequelize connection
  controllers/    # request handlers
  middleware/     # auth guard + centralized error handling
  models/         # Sequelize models (User, Workspace, Project, TimeEntry)
  routes/         # Express routers, mounted under /api
  types/          # ambient type augmentations (Express.Request.user)
  utils/          # JWT helpers, ApiError, asyncHandler
  app.ts          # Express app factory (middleware + routes)
  server.ts       # entry point: connects DB, then starts HTTP server
```

## Getting started

1. Copy `.env.example` to `.env` (already done for local development) and adjust values, especially `DB_*` and `JWT_SECRET`.
2. Create the PostgreSQL database named in `DB_NAME` (defaults to `clockify_dupe`).
3. Install dependencies:
   ```powershell
   npm install
   ```
4. Run in watch mode:
   ```powershell
   npm run dev
   ```
   The server syncs the Sequelize models automatically in development. For production, use proper migrations instead of `sequelize.sync()`.
5. Build and run the compiled output:
   ```powershell
   npm run build
   npm start
   ```

## API overview

All routes are mounted under `/api`.

| Method | Route                     | Auth | Description                       |
| ------ | ------------------------- | ---- | ---------------------------------- |
| GET    | `/health`                 | No   | Health check                       |
| POST   | `/auth/register`          | No   | Create a user, returns a JWT        |
| POST   | `/auth/login`             | No   | Log in, returns a JWT               |
| GET    | `/auth/me`                | Yes  | Current authenticated user          |
| GET    | `/workspaces`             | Yes  | List the caller's workspaces        |
| POST   | `/workspaces`             | Yes  | Create a workspace                  |
| GET    | `/workspaces/:id`         | Yes  | Get a workspace                     |
| DELETE | `/workspaces/:id`         | Yes  | Delete a workspace                  |
| GET    | `/projects?workspaceId=`  | Yes  | List projects in a workspace        |
| POST   | `/projects`               | Yes  | Create a project                    |
| DELETE | `/projects/:id`           | Yes  | Delete a project                    |
| GET    | `/time-entries`           | Yes  | List the caller's time entries      |
| POST   | `/time-entries/start`     | Yes  | Start a new running timer           |
| POST   | `/time-entries/:id/stop`  | Yes  | Stop a running timer                |
| PATCH  | `/time-entries/:id`       | Yes  | Update a time entry                 |
| DELETE | `/time-entries/:id`       | Yes  | Delete a time entry                 |

Authenticated routes expect `Authorization: Bearer <token>`.

This is a scaffold: extend it with validation (e.g. zod/celebrate), migrations, pagination, roles/permissions, and tests as the app grows.
