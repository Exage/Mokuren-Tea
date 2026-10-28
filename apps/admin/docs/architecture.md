# Admin architecture

The app follows [client architecture](../../client/docs/architecture.md): Next.js
App Router, strict TypeScript, CSS Modules, `@/` mapped to the application root,
thin route files, named screen exports, and colocated component hooks.

`app/layout.tsx` owns the document. `(web)/(protected)/layout.tsx` checks the
backend session and owns `AdminShell`. The shell is server-rendered;
navigation and session controls are client components.
At narrow widths, the sidebar becomes a horizontally scrollable navigation row.
Keyboard focus, the skip link, current-page semantics, and reduced motion are supported.
Navigation uses a single list of links without grouping or numbering. The shell
keeps a text link to the overview and does not render a workspace header or logo
emblem.

All interface copy, metadata, and accessibility labels use English. The root
layout loads Inter and Cormorant Garamond with `next/font/google`, matching the
storefront. CSS Modules use the shared `--font-body`, `--font-heading`, and color
tokens; headings use weight 600 and navigation uses weights 500 and 600.

`HomeScreen` composes the overview layout. Its metrics, reservation summary, and
quick actions live under `screens/home/components/`, with their own CSS Modules
and named exports. The two overview panels share a screen-local `OverviewPanel`
for their section and heading styles. Static components do not need hooks.
Products, media, and inventory compose interactive workspaces under their screen
folders. Categories and taste notes share a dictionary editor. The other screens
compose `SectionPreview`, which owns its CSS. Put screen-specific components
under `screens/<name>/components/`. Do not add empty CSS, hooks, or API directories.

`packages/ui` is the cross-application boundary for reusable controls.
It contains Button, Select, DropdownTrigger, Input, Checkbox, Textarea, and shared
visual tokens. Admin forms import these controls instead of rendering native
controls with local styles. Field labels and form layouts remain app-specific.
Both Next apps compile its TypeScript directly. App-specific typography, resets,
screens, navigation, query state, and backend requests stay inside their applications.

Requests belong in `app/shared/api/requests/`, with explicit endpoint
functions and browser-safe response types under `app/shared/api/types/`.
NestJS remains responsible for authentication, validation, inventory calculations,
price totals, permissions, and transactions. Do not duplicate these in Next.js.

The admin uses a same-origin `/api/admin/:path*` rewrite to the configured
`ADMIN_API_URL`. NestJS owns cookie issuance, revocation, rotation, and CSRF
validation. Browser authentication requests bootstrap the readable CSRF cookie
through the 204 endpoint and echo it in `X-CSRF-Token`; session tokens are never
read by browser code. A CSRF rejection is retried once after refreshing the token;
other mutations are not retried automatically. Requests have a 15-second timeout.

`admin-session.ts` is server-only and forwards only the session cookie to the
backend's `me` endpoint with `no-store`. Its React cache is render-scoped.
Every protected screen checks the session before rendering; the layout alone
cannot guard client navigation or the screen's RSC payload. Forced password
changes redirect to `/change-password`, which also requires a valid session.
The sign-in screen redirects authenticated users to the appropriate destination.
Backend outages fail closed into the root error boundary with a reload action.
The session controls refresh on focus, visibility changes, and page restoration.
Future private data requests must enforce authentication at their own boundary
and continue to rely on backend authorization guards.

Catalog endpoint contracts stay explicit in `products.ts`, `media.ts`,
`dictionaries.ts`, and `inventory.ts`. Their shared `catalog-request.ts` transport
reuses the authentication CSRF bootstrap and response errors, sets timeouts and
credentials, and redirects expired sessions or required password changes.
It retries only CSRF rejections. Stock mutations additionally carry an idempotency
key that is reused after uncertain results; other mutations are never retried
automatically. No query provider is included.

`catalog-data.hook.ts` shares cancellable pagination/search state and mutation
submission locks. Lists ignore obsolete responses and distinguish loading,
errors, and empty results. Reference pickers page through the full dictionaries
and ready media library. Every data endpoint still relies on backend guards.
Interactive state and callbacks live in colocated hooks.

ESLint enforces braces around conditional bodies and rejects single-line blocks,
in addition to the Next.js and TypeScript rules. Run Prettier separately to check
the repository's formatting conventions.
