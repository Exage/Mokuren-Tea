# Mokuren Tea backend

NestJS API using TypeScript, ESM, and MongoDB through `@nestjs/mongoose`.
Run the following commands from the monorepo root with the Node.js version in `.nvmrc`.

## Setup

```sh
pnpm install --frozen-lockfile
cp apps/backend/.env.example apps/backend/.env
pnpm --filter @mokuren/backend db:up
pnpm dev --filter=@mokuren/backend
```

`db:up` requires Docker with Compose running. It starts a local MongoDB instance,
waits for its health check, and stores data in a named Docker volume. The database
is exposed only on `127.0.0.1:27017`. This Compose configuration has no authentication
and is intended for local development only.

If MongoDB already runs locally, skip `db:up`. For MongoDB Atlas or another server,
set `MONGODB_URI` to its connection string. Avoid running two databases on the same port.

## Environment

| Variable      | Default       | Purpose                                               |
| ------------- | ------------- | ----------------------------------------------------- |
| `NODE_ENV`    | `development` | `development`, `test`, or `production`                |
| `PORT`        | `3001`        | HTTP port, from 1 to 65535                            |
| `MONGODB_URI` | Required      | MongoDB connection string including the database name |

The application loads `.env` from this directory, including when launched from a
different working directory. Process environment variables take precedence.
Configuration is validated at startup. `.env` is ignored by Git.
The Turbo development task forwards these variables when supplied by the shell.

## Commands

```sh
pnpm dev --filter=@mokuren/backend
pnpm build --filter=@mokuren/backend
pnpm --filter @mokuren/backend start
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @mokuren/backend db:down
```

`start` runs the compiled application; run `build` first. The root `pnpm test`
command builds through Turbo before running the backend's Node.js tests. The
package-level `test` command requires an existing build. Tests cover configuration
validation and health check failure handling and do not require MongoDB.
`db:down` stops the local database and retains its data volume.

## Health check

`GET /api/health` sends a MongoDB ping and returns:

```json
{ "status": "ok", "database": "up" }
```

After startup, a database outage returns HTTP 503 with
`{ "status": "error", "database": "down" }`. At startup, MongoDB must be reachable
before HTTP requests are accepted. Connection attempts use bounded timeouts and retries.
Shutdown hooks close the connection when the process receives a termination signal.

## Structure

```text
src/
  main.ts                       HTTP bootstrap and shutdown hooks
  app-module.ts                 Configuration and MongoDB connection
  config/environment.ts         Environment validation
  health/health-controller.ts    API and database readiness
test/                           Configuration and health checks
```

Add business modules and Mongoose schemas when their requirements are defined.
In production, supply deployment environment variables and use an authenticated
MongoDB service. Automatic index creation is disabled in production; manage indexes
explicitly when introducing schemas.

Integration reference: [NestJS MongoDB documentation](https://docs.nestjs.com/techniques/mongodb).
