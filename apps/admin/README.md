# Mokuren Tea admin

A separate Next.js application using the same routes/screens/shared organization
as `apps/client`. Run from the monorepo root:

```sh
pnpm install --frozen-lockfile
pnpm --filter admin dev
```

Open `http://localhost:3002`. The storefront uses port 3000 and NestJS uses 3001.
The root `pnpm dev` also discovers this application through the existing workspace.

Run the backend and its database before signing in. The default API root is
`http://127.0.0.1:3001/api`; copy `.env.example` to `.env.local` if it needs to
change. Restart Next.js after changing configuration. `ADMIN_API_URL` is used
both for server-side session checks and the `/api/admin/:path*` rewrite; set it
before building and keep the same value when starting the production server.

The browser uses the admin's own origin for API requests. Next.js forwards them
to NestJS, including its session and CSRF cookies. No additional CORS origin is
needed for this flow. Leave the backend's `SESSION_COOKIE_DOMAIN` empty for
host-only cookies, or configure a domain that includes the admin host. Use HTTPS
in production: the backend sets Secure cookies when `NODE_ENV=production`.
If overriding cookie names, match `SESSION_COOKIE_NAME` and
`NEXT_PUBLIC_CSRF_TOKEN_NAME` to the backend configuration. The latter is public
build-time configuration and contains a cookie name, never a token.

Use an existing administrator account. To provision the first account, follow
the backend's [bootstrap instructions](../backend/README.md); this app does not
create accounts or include demo credentials.

## Current scope

Session authentication is implemented: `/login`, current administrator checks,
sign-out, and `/change-password`. A temporary-password account must change its
password before opening administrative sections. The session lives in the
backend's HttpOnly cookie; every authentication mutation sends a matching CSRF
header. The forms handle invalid credentials, validation, throttling, CSRF, and
network errors and prevent duplicate submissions.

Sign in with a login and password. Logins are trimmed and case-insensitive;
they do not need to be email addresses. Existing accounts retain their previous
identifier as their login. Authentication responses expose `user.login` and
the `me` endpoint exposes `login`.

The catalog screens are connected to the backend:

- Products: search, status filters, pagination, draft creation, editing, ordered
  images, category/taste-note assignments, pack sizes and BYN prices, publication,
  and archiving. Archived products cannot be republished. Published edits take
  effect immediately. Save product details before changing variants or status.
- Media: multipart JPG/PNG/WebP uploads up to 10 MB, a searchable library,
  name/alternative-text editing, usage checks, and deletion of unused images.
  Cloudinary must be configured on the backend for uploads to succeed.
- Categories: names, slugs, display order, product counts, and transfer-and-delete.
- Taste notes: names, slugs, display order, product counts, and deletion with
  removal from linked products after reviewing usage.
- Inventory: product search, physical/reserved/available stock, receipts,
  write-offs, physical stock counts, movement history, and compensations.
  Stock changes require a reason and confirmation. Each submitted operation
  retains its idempotency key on retry after an uncertain response.

The overview, reservations, content, settings, administrators, and audit remain
previews. The overview uses dashes rather than fabricated shop statistics.

The interface, metadata, and accessibility labels use English. Shared brand
colors, radii, shadows, and reusable form controls come from `@mokuren/ui`.
Typography uses the storefront's Inter and Cormorant Garamond through
`next/font/google`, with semibold headings and medium-weight navigation. Font
assets are downloaded at build time and served locally by Next.js.
The sidebar is a single list without numbered links or group headings. The shell
has no workspace header, logo emblem, or administrator subtitle.

See [the API plan](docs/api-plan.md) for the next feature integrations.

## Structure

```text
app/
  layout.tsx                       # metadata, global styles, document
  (web)/(protected)/layout.tsx     # authenticated shell
  (web)/(protected)/<section>/     # existing section pages and metadata
  (web)/login/                     # sign-in page and metadata
  (web)/change-password/           # password page and metadata
  screens/<name>/                 # named Screen exports and screen-local UI
  shared/
    api/requests/                  # auth, catalog requests, server session check
    api/types/                     # browser-safe response types
    components/<name>/            # index, component, CSS Module, optional hook
    constants/navigation.ts
    styles/globals.css
docs/
  architecture.md
  api-plan.md
```

Each protected screen checks the backend session before rendering. React caches
that result only within the current render, so the layout and screen share one
check without sharing sessions across requests. Future private data requests
must still authenticate at their data boundary; NestJS guards remain the source
of authorization. Returning to a visible tab refreshes the session. Successful
sign-in, password change, and sign-out use full navigation to discard the previous
session's router cache. No polling is used.

## Checks

```sh
pnpm --filter admin lint
pnpm --filter admin typecheck
pnpm --filter admin test
pnpm --filter admin build
pnpm --filter @mokuren/ui lint
pnpm --filter @mokuren/ui typecheck
```

When changing shared UI, also lint, typecheck, and build `client`.
