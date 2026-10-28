# Mokuren Tea admin

A separate Next.js application using the same routes/screens/shared organization
as `apps/client`. Run from the monorepo root:

```sh
pnpm install --frozen-lockfile
pnpm --filter admin dev
```

Open `http://localhost:3002`. The storefront uses port 3000 and NestJS uses 3001.
The root `pnpm dev` also discovers this application through the existing workspace.

## Current scope

This is an initial UI scaffold: a responsive navigation shell, overview layout,
ten section previews, and a not-found screen. Links work; data, authentication,
forms, uploads, and mutations are **not implemented**. The overview uses dashes,
not fabricated shop statistics. The application currently makes no API requests
and needs no environment variables or running database.

The interface, metadata, and accessibility labels use English. Shared brand
colors, radii, shadows, and reusable form controls come from `@mokuren/ui`.
Typography uses the storefront's Inter and Cormorant Garamond through
`next/font/google`, with semibold headings and medium-weight navigation. Font
assets are downloaded at build time and served locally by Next.js.
The sidebar is a single list without numbered links or group headings. The shell
has no workspace header, logo emblem, or administrator subtitle.

Before connecting real administrative data, implement the session flow and forced
password change described in [the API plan](docs/api-plan.md).

## Structure

```text
app/
  layout.tsx                       # metadata, global styles, document and shell
  (web)/<section>/page.tsx         # only imports and renders its screen
  (web)/<section>/layout.tsx       # section metadata
  screens/<name>/                 # named Screen exports and screen-local UI
  shared/
    components/<name>/            # index, component, CSS Module, optional hook
    constants/navigation.ts
    styles/globals.css
docs/
  architecture.md
  api-plan.md
```

No API clients, empty hooks, or speculative domain types are included.

## Checks

```sh
pnpm --filter admin lint
pnpm --filter admin typecheck
pnpm --filter admin build
pnpm --filter @mokuren/ui lint
pnpm --filter @mokuren/ui typecheck
```

When changing shared UI, also lint, typecheck, and build `client`.
