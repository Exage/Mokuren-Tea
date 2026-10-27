<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Mokuren Tea client

Read [the client architecture guide](docs/architecture.md) before adding routes,
screens, components, hooks, or styles. Root repository rules also apply.

- Browser routes live in `app/(web)/`. A `page.tsx` only imports and renders its screen.
- Screens live in `app/screens/<name>/` and use named exports with the `Screen` suffix.
- Component folders contain `index.ts`, `<name>.component.tsx`, and `<name>.module.css`.
- Add a colocated `<name>.hook.ts` when state, callbacks, or effects are needed.
  Hook names use `use<Name>Hook`; screen hooks use `use<Name>ScreenHook`.
- Use CSS Modules for component styles: `import styles from './<name>.module.css'`
  and `className={styles.title}`. Do not add Tailwind, utility-class frameworks,
  or CSS-in-JS. Keep selectors locally scoped; avoid `:global` overrides.
- Use `clsx` to combine conditional or multiple CSS class names.
- Do not use `padding-block`. Use `padding` shorthand (for example, `padding: 12px 0`)
  or explicit `padding-top` and `padding-bottom` declarations instead.
- Do not use `padding-inline`. Use `padding` shorthand (for example, `padding: 0 12px`)
  or explicit `padding-left` and `padding-right` declarations instead.
- Put shared styles in `app/shared/styles/`. Keep `globals.css` there limited to
  tokens, resets, and document-wide defaults, and import it from the root layout.
- Put screen-specific components in the screen's `components/` folder. Keep
  storefront-wide components in `app/shared/components/`. Reusable controls
  Button, Select, DropdownTrigger, and Input live in `packages/ui/src/components/`
  and are imported through `@mokuren/ui/<name>`.
- Keep components server-rendered by default. Add `'use client'` to an interactive
  component that uses hooks, event handlers, or browser APIs.
- Do not import backend source code into the frontend. Add explicit request functions
  under `app/shared/api/requests/` when backend integration is needed.
- Do not create empty hooks, placeholder API clients, or unused layers.
- Use `pnpm` from the monorepo root. Run `pnpm --filter client lint`,
  `pnpm --filter client typecheck`, and `pnpm --filter client build` after changes.
