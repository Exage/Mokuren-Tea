# Mokuren Tea client

The React storefront application, built with Next.js App Router and TypeScript.
Components use colocated CSS Modules with locally scoped class names.

## Development

Use the repository's Node.js and pnpm versions. From the monorepo root:

```sh
pnpm install --frozen-lockfile
pnpm --filter client dev
```

Open [localhost:3000](http://localhost:3000). The initial page is a minimal Mokuren Tea
screen; product features and backend integration can be added as they are developed.

## Commands

Run these commands from the monorepo root:

```sh
pnpm --filter client dev
pnpm --filter client lint
pnpm --filter client typecheck
pnpm --filter client build
pnpm --filter client start
```

Root `pnpm dev`, `pnpm build`, `pnpm lint`, and `pnpm typecheck` also include the
client through the workspace task runner.

## Architecture

See [the architecture guide](docs/architecture.md) for the file layout, component and
hook conventions, CSS rules, and backend integration boundaries.

- `app/(web)/` contains route files that render screens.
- `app/screens/` contains screen components and their local logic and styles.
- `app/shared/components/` contains application-wide UI components.
- `app/shared/styles/` contains shared styles, including global tokens and document-wide defaults.

Every component folder contains `<name>.component.tsx`, `<name>.module.css`, and `index.ts`.
Add `<name>.hook.ts` beside them when the component needs state or interaction logic.
