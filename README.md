# Mokuren Tea

A minimal monorepo scaffold using pnpm workspaces and Turborepo.
Applications and shared packages will be added as development progresses.

## Requirements

- Node.js 24 (the exact version for nvm is specified in `.nvmrc`).
- pnpm 11.0.8 (pinned in `package.json`).

## Installation

```sh
pnpm install --frozen-lockfile
```

## Structure

```text
apps/       — future storefront, backend, and admin applications
packages/   — future shared packages and configuration
```

These directories are currently empty; `.gitkeep` files preserve them in Git.

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
`package.json`. Until applications and packages are added, these commands execute no tasks.

`pnpm format` and `pnpm format:check` run directly from the root and process
supported files throughout the monorepo, including `apps/` and `packages/`.
Shared formatting rules are defined in `.prettierrc.json`; local configurations
can override them. Formatting on save in VS Code requires the
`esbenp.prettier-vscode` extension; workspace settings are already defined in
`.vscode/settings.json`.

Build caching is currently disabled. When adding applications, specify their
actual build artifacts in `outputs` and enable caching. Configure test caching
after choosing the testing tools.

## Adding an application or package

1. Create a directory under `apps/` or `packages/`.
2. Add a `package.json` with a unique name, `private: true`, and the required scripts.
3. Declare the dependencies used by the application or package in its `package.json`.
4. Run `pnpm install` from the monorepo root.

Use `workspace:*` for local dependencies.
Commit `pnpm-lock.yaml` to Git and install dependencies in CI with
`pnpm install --frozen-lockfile`.
