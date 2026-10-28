# Admin architecture

The app follows [client architecture](../../client/docs/architecture.md): Next.js
App Router, strict TypeScript, CSS Modules, `@/` mapped to the application root,
thin route files, named screen exports, and colocated component hooks.

`app/layout.tsx` owns the document and `AdminShell`. The shell is server-rendered;
only navigation is a client component because it reads the current pathname.
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
Other screens currently compose
`SectionPreview`, which owns its CSS. Replace each preview with the actual feature
inside its screen directory as integrations arrive. Put screen-specific components
under `screens/<name>/components/`. Do not add empty CSS, hooks, or API directories.

`packages/ui` is the cross-application boundary for reusable controls.
It contains Button, Select, DropdownTrigger, Input, and shared visual tokens.
Both Next apps compile its TypeScript directly. App-specific typography, resets,
screens, navigation, query state, and backend requests stay inside their applications.

Future requests belong in `app/shared/api/requests/`, with explicit endpoint
functions and browser-safe response types under `app/shared/api/types/`.
NestJS remains responsible for authentication, validation, inventory calculations,
price totals, permissions, and transactions. Do not duplicate these in Next.js.

The initial scaffold does not introduce a query provider, generic HTTP client,
frontend auth simulation, or backend proxy. Choose the deployment origin strategy
when implementing auth, including cookie scope and CSRF handling.

ESLint enforces braces around conditional bodies and rejects single-line blocks,
in addition to the Next.js and TypeScript rules. Run Prettier separately to check
the repository's formatting conventions.
