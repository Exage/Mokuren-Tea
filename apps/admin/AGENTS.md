# Mokuren Tea admin

Read [the architecture guide](docs/architecture.md) before changing this app.
Root repository rules apply. Use the installed Next.js documentation in
`node_modules/next/dist/docs/` before changing framework conventions.

- Keep the same routes/screens/shared structure as `apps/client`.
- Routes belong in `app/(web)/`; each `page.tsx` only imports and renders a screen.
- Screens use named exports ending in `Screen` and kebab-case filenames.
- Components with their own styles use `index.ts`, `<name>.component.tsx`, and
  `<name>.module.css`. Screens that only compose shared components need no empty CSS.
- Put state and callbacks in colocated `<name>.hook.ts` files, using
  `use<Name>Hook` or `use<Name>ScreenHook`. Do not create empty hooks.
- Use CSS Modules and `clsx`. Do not use Tailwind, CSS-in-JS, `:global` overrides,
  `padding-inline`, or `padding-block`.
- Keep server components by default; mark interactive boundaries with `'use client'`.
- Use reusable controls from `@mokuren/ui` (Button, Input, Select,
  DropdownTrigger, Checkbox, and Textarea) and `@mokuren/ui/tokens.css`.
  Add new reusable controls to `packages/ui` instead of duplicating them here.
- Use English for all interface copy, metadata, and accessibility labels.
- Use Inter for body text and navigation, and Cormorant Garamond for headings,
  matching the storefront. Use shared color tokens and readable font weights.
- Keep navigation as a single list without group headings or numbered items.
  Do not add a workspace header, logo emblem, or administrator subtitle.
- Keep endpoint requests in `app/shared/api/requests/` once implemented. Never import
  backend source or storefront internals into this application.
- Do not present demo values as real statistics or expose administrative data before
  implementing authentication. Root metadata's noindex is not access control.
- Use pnpm from the repository root. Run admin lint, typecheck, and build; check
  client and shared UI too when their source changes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
