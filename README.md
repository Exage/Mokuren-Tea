# Mokuren Tea

A monorepo using pnpm workspaces and Turborepo.
The NestJS backend connects to MongoDB through Mongoose.

## Requirements

- Node.js 24 (the exact version for nvm is specified in `.nvmrc`).
- pnpm 11.0.8 (pinned in `package.json`).

## Installation

```sh
pnpm install --frozen-lockfile
```

## Structure

```text
apps/backend/ — NestJS API and local MongoDB configuration
apps/client/  — Next.js and React storefront with colocated CSS Modules
apps/admin/   — separate Next.js administrative UI scaffold
packages/ui/  — shared form controls and brand tokens for both frontends
```

See [the backend guide](apps/backend/README.md) for configuration and commands.
See [the client guide](apps/client/README.md) for UI development and architecture.
See [the admin guide](apps/admin/README.md) for the scaffold and API integration plan.

## Local development

```sh
cp apps/backend/.env.example apps/backend/.env
pnpm --filter @mokuren/backend db:up
pnpm dev
```

The database command requires Docker with Compose running. It automatically
initializes a single-node replica set and publishes container port `27017` at
`127.0.0.1:27018`. Data is stored in a persistent Docker volume. If a suitable
MongoDB replica set is already available, skip this command and set `MONGODB_URI`
in `apps/backend/.env`.
The API health endpoint is `http://localhost:3001/api/health`.
The storefront is available at `http://localhost:3000`. To work on the UI alone,
run `pnpm --filter client dev`; the current static screen does not require MongoDB.
The admin scaffold is available at `http://localhost:3002`; run
`pnpm --filter admin dev` to work on it without starting the backend.

## Commands

```sh
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm format
pnpm format:check
```

Turborepo runs the corresponding scripts from each application's or package's
`package.json`. Backend tests build the application first through the Turbo task graph.

`pnpm format` and `pnpm format:check` run directly from the root and process
supported files throughout the monorepo, including `apps/` and `packages/`.
Shared formatting rules are defined in `.prettierrc.json`; local configurations
can override them. Formatting on save in VS Code requires the
`esbenp.prettier-vscode` extension; workspace settings are already defined in
`.vscode/settings.json`.

Build caching is enabled for the backend's `dist/` artifacts in its package-level
`turbo.json`. The root defaults keep build and test caching disabled for new packages.

## Adding an application or package

1. Create a directory under `apps/` or `packages/`.
2. Add a `package.json` with a unique name, `private: true`, and the required scripts.
3. Declare the dependencies used by the application or package in its `package.json`.
4. Run `pnpm install` from the monorepo root.

Use `workspace:*` for local dependencies.
Commit `pnpm-lock.yaml` to Git and install dependencies in CI with
`pnpm install --frozen-lockfile`.
