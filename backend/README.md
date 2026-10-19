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
  models/         # Sequelize models (User, Workspace, Project, Task, TimeEntry)
  migrations/     # SQL migrations for production schema upgrades
  routes/         # Express routers, mounted under /api
  types/          # ambient type augmentations (Express.Request.user)
  utils/          # JWT helpers, ApiError, asyncHandler
  app.ts          # Express app factory (middleware + routes)
  server.ts       # entry point: connects DB, then starts HTTP server
```

## Getting started

1. Copy `.env.example` to `.env` (already done for local development) and adjust values, especially `DB_*` and `JWT_SECRET`.
2. Create the PostgreSQL database named in `DB_NAME` (defaults to `clockify_dupe`).
3. For an existing production database, apply both schema migrations before deployment:
   ```powershell
   psql -U postgres -d clockify_dupe -f migrations/20261019-add-project-tasks.sql
   psql -U postgres -d clockify_dupe -f migrations/20261019-add-project-numbers.sql
   ```
4. Install dependencies:
   ```powershell
   npm install
   ```
5. Run in watch mode:
   ```powershell
   npm run dev
   ```
   The server syncs/updates the Sequelize models automatically in development. For production, apply the SQL migrations before deploying instead of using `sequelize.sync()`.
6. Build and run the compiled output:
   ```powershell
   npm run build
   npm start
   ```

## API overview

All routes are mounted under `/api`. New projects require a three-digit `projectNumber`. The project-number migration leaves existing records unset so their numbers can be added from the project options menu.

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
| GET    | `/projects?workspaceId=`  | Yes  | List projects in a workspace; `includeTasks=true` embeds project tasks |
| POST   | `/projects`               | Yes  | Create a project                    |
| PATCH  | `/projects/:id`            | Yes  | Update project details or color      |
| DELETE | `/projects/:id`           | Yes  | Delete a project                    |
| GET    | `/projects/:projectId/tasks` | Yes | List tasks for a project          |
| POST   | `/projects/:projectId/tasks` | Yes | Create a task in a project        |
| PATCH  | `/projects/:projectId/tasks/:taskId` | Yes | Update a task name            |
| DELETE | `/projects/:projectId/tasks/:taskId` | Yes | Delete an unused task      |
| GET    | `/time-entries`           | Yes  | List the caller's time entries      |
| POST   | `/time-entries/start`     | Yes  | Start a timer (requires `taskId`)   |
| POST   | `/time-entries/:id/stop`  | Yes  | Stop a running timer; optionally save `taskId` and `startTime` with the stop |
| PATCH  | `/time-entries/:id`       | Yes  | Update description, task/project, billable status, start/end; recalculates duration |
| DELETE | `/time-entries/:id`       | Yes  | Delete a time entry                 |
| GET    | `/reports/users`          | Yes  | List user IDs and names available in reports |
| GET    | `/reports/time-entries?userId=` | Yes | List report entries for the caller, one selected user, or all users |

Authenticated routes expect `Authorization: Bearer <token>`.
Every newly started or updated time entry must have a task belonging to a project in the authenticated user's workspace. Tasks already referenced by a time entry cannot be deleted. The schema migration leaves `task_id` nullable only to preserve historical records created before task assignment was required.

Reports default to the authenticated user's entries. The `userId=all` option includes every registered user's entries; a specific `userId` selects one user's entries. This is global visibility across the app rather than workspace-scoped. The report user list and entry owner association expose only user IDs and names.

This is a scaffold: extend it with validation (e.g. zod/celebrate), migrations, pagination, roles/permissions, and tests as the app grows.
