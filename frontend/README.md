# Frontend — Clockify Dupe

Angular frontend scaffold for the time recording system. Standalone components, lazy-loaded routes, signals for state, Inter (bundled locally), and a custom (no UI library) design system so the whole app stays visually consistent.

## Project structure

```
src/
  app/
    core/
      guards/         # authGuard - protects authenticated routes
      interceptors/    # authInterceptor - attaches the JWT bearer token
      models/          # shared TypeScript interfaces (User, Workspace, Project, TimeEntry)
      services/        # Auth, Workspace, Project, TimeEntry - talk to the backend API
    features/
      auth/login/      # login page
      auth/register/   # registration page
      dashboard/       # time tracker page (project/task selection, start/stop timer, entries)
      projects/        # project and task management
      reports/         # summary and detailed time reports with date/project/task/user/billable filters
    layout/
      shell/           # authenticated app shell: navbar + <router-outlet>
    app.routes.ts       # route table (public auth routes + guarded shell routes)
    app.config.ts       # app-wide providers (router, HttpClient + interceptor)
  environments/         # apiUrl per environment (dev points at http://localhost:4000/api)
  styles/               # shared design tokens (_tokens.scss), resets (_base.scss),
                        # and reusable classes (_components.scss: .btn, .card, .form-field, ...)
  styles.scss           # imports the styles/ partials globally
```

To keep the UI uniform without a component library, build new pages with the classes defined in `src/styles/_components.scss` (`.page`, `.card`, `.btn`/`.btn-primary`/`.btn-secondary`/`.btn-danger`, `.form-field`, `.navbar`) and the CSS custom properties in `src/styles/_tokens.scss` (colors, spacing, radius). Re-theme the whole app by editing the tokens file.

By default the app expects the backend API at `http://localhost:4000/api` (see `src/environments/environment.development.ts`); update `environment.ts` for the production API URL.

The Reports page supports date presets/custom dates, project, task, billable status, and user filters, summary totals, a project breakdown, and a detailed entry table. Its default is the signed-in user's entries; selecting all users includes every registered user's entries in this app.

---

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.27.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

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
