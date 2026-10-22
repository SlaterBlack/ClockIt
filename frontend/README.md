# Frontend — ClockIt

Angular frontend scaffold for the time recording system. Standalone components, lazy-loaded routes, signals for state, Inter (bundled locally), and a custom (no UI library) design system so the whole app stays visually consistent.

## Project structure

```
src/
  app/
    core/
      guards/         # authGuard, adminGuard - protect authenticated/admin-only routes
      interceptors/    # authInterceptor - attaches the JWT bearer token
      models/          # shared TypeScript interfaces (User, Workspace, Project, TimeEntry)
      services/        # Auth, User, Workspace, Project, TimeEntry - talk to the backend API
    features/
      auth/login/      # login page (there is no public sign-up; admins create accounts)
      dashboard/       # time tracker page (start/stop, manual entries, replay from history)
      projects/        # project and task management
      reports/         # summary and detailed time reports with date/project/task/user/billable filters
      profile/         # signed-in user's account details
      users/           # admin-only user management (list/create/edit role/delete)
    layout/
      shell/           # authenticated app shell: navbar + <router-outlet>
    app.routes.ts       # route table (public auth routes + guarded shell routes)
    app.config.ts       # app-wide providers (router, HttpClient + interceptor)
  environments/         # apiUrl per environment (dev uses /api, proxied to http://localhost:4000)
  styles/               # shared design tokens (_tokens.scss), resets (_base.scss),
                        # and reusable classes (_components.scss: .btn, .card, .form-field, ...)
  styles.scss           # imports the styles/ partials globally
```

To keep the UI uniform without a component library, build new pages with the classes defined in `src/styles/_components.scss` (`.page`, `.card`, `.btn`/`.btn-primary`/`.btn-secondary`/`.btn-danger`, `.form-field`, `.navbar`) and the CSS custom properties in `src/styles/_tokens.scss` (colors, spacing, radius). Re-theme the whole app by editing the tokens file.

In development the app calls the API at the relative path `/api` (see `src/environments/environment.development.ts`); the dev server forwards it to the backend on `http://localhost:4000` via `proxy.conf.json`. Update `environment.ts` for the production API URL.

The Reports page supports date presets/custom dates, project, task, billable status, and user filters, summary totals, a project breakdown, and a detailed entry table. Its default is the signed-in user's entries; selecting all users includes every registered user's entries in this app.

There is no public registration page. Click your username in the navigation bar to open account actions and edit your own name, email or password. Admins also have a Manage users action where they create accounts, change other users' roles/passwords, and delete accounts (an admin can't delete or demote the last remaining admin).

Tracker time inputs accept 12-hour and 24-hour text formats such as `9am`, `9.15am`, `9:15`, `0915`, and `9.15`. Valid input is normalized when the field loses focus; the date remains separately editable.

### Report exports

The Export card on the Reports page downloads exactly the entries matching the current filters:

- **Export CSV** – one row per entry (date, start/end time, user, project number/name, task, description, billable, `hh:mm:ss` and decimal-hour durations). Running entries are included with their duration so far. Text cells starting with `=`, `+`, `-` or `@` are prefixed with `'` to prevent spreadsheet formula injection.
- **Export to Xero payroll** – a timesheet CSV for Xero Payroll (Australia) with the columns `Employee`, `Date` (`DD/MM/YYYY`), `Earnings Rate` and `Hours`. All completed entries (billable or not) are totalled into one row per employee, day and earnings rate; running timers are skipped. Each task has a pay type (Hourly Pay, Public Holiday, Sick Leave or Annual Leave, set on the Projects page; existing tasks are Hourly Pay), and each pay type maps to an earnings rate name entered in the export form (defaults: `Ordinary Hours`, `Public Holiday`, `Sick Leave`, `Annual Leave`). Those names must match the earnings rates in your Xero payroll settings, and employee names must match Xero's employee records. Pay types mapped to the same name are merged. Xero's help pages couldn't be checked automatically, so compare the headers with the timesheet template downloaded from your Xero Payroll import screen and adjust if they differ.

A direct Xero API (OAuth 2.0) push is not implemented yet.

---

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.27.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

### Access from other devices on the network

The development server listens on all network interfaces. To open it from another device on the same network, use the development machine's network address and port `4200` (the `Network:` URL printed by `ng serve`, or find the address using your operating system's network tools). API calls go through the development-server proxy to the backend. If the page is unreachable, allow inbound TCP traffic on port `4200` in the development machine's firewall. Avoid exposing the development server to untrusted networks.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
