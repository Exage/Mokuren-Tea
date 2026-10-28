# Mokuren Tea client

The React storefront application, built with Next.js App Router and TypeScript.
Components use colocated CSS Modules with locally scoped class names.

## Development

Use the repository's Node.js and pnpm versions. From the monorepo root:

```sh
pnpm install --frozen-lockfile
pnpm --filter client dev
```

Open [localhost:3000](http://localhost:3000). The backend must be running to load the storefront catalog and published content.

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
- `app/shared/components/` contains storefront components. Reusable form controls
  live in `packages/ui/src/components/`.
- `app/shared/styles/` contains shared styles, including global tokens and document-wide defaults.

Every component folder contains `<name>.component.tsx`, `<name>.module.css`, and `index.ts`.
Add `<name>.hook.ts` beside them when the component needs state or interaction logic.

### Storefront API

Set `API_URL` to the backend API base URL, including `/api` (for example,
`http://localhost:3001/api`). If unset, the client uses that local address.
The API must be reachable during production builds and at runtime. Home, about,
contacts, and the initial catalog are prerendered with their CMS content and
initial product data, so their initial HTML contains the page content rather
than a page-wide loading skeleton. A build fails if the required API data cannot
be loaded.

Published CMS content is cached on the server with a five-minute revalidation
interval; unpublished blocks use the existing default text. Revalidation is
triggered by traffic, not a timer: after that interval, a request can receive the
cached content while it refreshes in the background. Publishing in the admin
does not immediately invalidate the storefront cache. Cache entries expire after
one hour, at which point fresh data is required. API failures are not converted
into default published content; Next.js may continue serving previously cached
content when background revalidation fails.

For interactive catalog requests, set `NEXT_PUBLIC_API_URL` at **build time** to
the publicly reachable backend API base URL, including `/api`. It defaults to
`http://localhost:3001/api` for local development. The backend must allow the
storefront origin in `CORS_ORIGINS` (for example, `http://localhost:3000`).
`API_URL` is server-only and may use a different internal address. Both URLs must
refer to the same backend. Set these in `apps/client/.env.local` for local use.

The server loads the first page, categories and taste notes with a five-minute
revalidation interval. TanStack Query manages filtered and paginated requests in
the browser with a five-minute freshness window. The two caches are independent,
so changes can take longer than five minutes to become visible. Availability is
informational; the backend must verify stock when a reservation is submitted.
