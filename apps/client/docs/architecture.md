# Client architecture

The client uses the existing Next.js App Router, React, and strict TypeScript
template. Its organization follows the routes, screens, and shared components
approach used in MusMetaEdit, adapted for Mokuren Tea and CSS Modules.

## Current structure

```text
app/
  layout.tsx
  (web)/
    page.tsx
  screens/
    home/
      index.ts
      home.component.tsx
      home.module.css
  shared/
    styles/
      globals.css
    components/
      container/
        index.ts
        container.component.tsx
        container.module.css
packages/ui/src/components/
  input/
    index.ts
    input.component.tsx
    input.module.css
```

`layout.tsx` owns document metadata, the document shell, and the
`app/shared/styles/globals.css` import.
Browser routes live in `(web)`, which does not add a URL segment. For example,
`app/(web)/catalog/page.tsx` maps to `/catalog`.

Each `page.tsx` only imports and renders its screen. JSX and layout belong in the
screen component; state and interaction logic belong in its hook when needed.
The current home screen is static and does not need a hook or `'use client'`.

## Component convention

Screens, screen-local components, and shared components use the same colocated
file structure:

```text
<name>/
  index.ts
  <name>.component.tsx
  <name>.module.css
  <name>.hook.ts          # only when state, callbacks, or effects are needed
```

- Use kebab-case file and folder names.
- Export components as named functions through `index.ts`.
- Screen names end in `Screen`, such as `HomeScreen`.
- Custom hooks use `use<Name>Hook`, such as `useHomeScreenHook` or
  `useProductCardHook`. Keep hooks without JSX in `.ts` files.
- Import a component's CSS Module as `styles` in its `.component.tsx` file.
- Import storefront components using the `@/` alias, which points to the client
  project root. Import shared controls from `@mokuren/ui/<name>`.
- Keep small prop types in the component or hook. Add separate types or constants
  files only when their size or reuse justifies it.

An interactive component starts with `'use client'`, imports its hook, and renders
the state and callbacks returned by that hook. Route files remain server components.
Do not create an empty hook just to complete the folder pattern.

## CSS convention

Use colocated `.module.css` files and access class names through the imported
`styles` object. CSS Modules generate unique class names, so selectors stay local
to their component. There are no Tailwind dependencies or runtime styling libraries.

```tsx
import styles from './product-card.module.css'

export function ProductCard() {
  return (
    <article className={styles.card}>
      <h2 className={styles.title}>Sencha</h2>
    </article>
  )
}
```

```css
.card {
  padding: 1.5rem;
}

.title {
  color: var(--color-text);
}
```

Use short semantic class names such as `.card`, `.title`, or `.active`; component
prefixes are not required. Scope element selectors under a local class and avoid
`:global` overrides. Responsive rules and interaction states stay in the same module.

Put shared styles in `app/shared/styles/`. Its `globals.css` contains only shared
CSS variables, resets, typography defaults, and document-wide accessibility defaults.
Brand colors, radii, and shadows are imported from `@mokuren/ui/tokens.css`.
Button, Select, DropdownTrigger, and Input live in `packages/ui` and are
imported via `@mokuren/ui/<name>`. Storefront components such as Header, Footer,
ProductCard, Container, Description, Eyebrow, and Title remain in
`app/shared/components/`.
Import it once from the root layout. Add other shared stylesheets in this directory
when needed; shared class-based styles can use CSS Modules as well. Keep styles
owned by a component in that component's folder.

### Typography

Heading and quote sizes use shared `rem` tokens in `globals.css`. Sizes change
only at the existing 1024px and 560px breakpoints; do not use viewport units or
`clamp()` for font sizes. Body text, labels, and controls keep their existing
component sizes.

| Role                                               | Desktop (>1024px) | Tablet (561–1024px) | Mobile (≤560px) |
| -------------------------------------------------- | ----------------- | ------------------- | --------------- |
| Hero (`3xl`)                                       | 6.8rem            | 5.6rem              | 4.4rem          |
| Page heading (`2xl`)                               | 6rem              | 4.8rem              | 4rem            |
| Section heading (`xl`)                             | 4.8rem            | 4rem                | 3.2rem          |
| Compact heading (`lg`), reviews and visit sections | 4.2rem            | 3.6rem              | 3rem            |
| Product page heading                               | 5.4rem            | 4.4rem              | 3.6rem          |
| Review quote                                       | 2.6rem            | 2.4rem              | 2.2rem          |

About, catalog, and contacts share the page-heading scale. Product headings use
a smaller scale for longer names in the two-column layout. Keep these visual
sizes independent of the existing semantic heading elements.

## Where new code belongs

| Code                                    | Location                                |
| --------------------------------------- | --------------------------------------- |
| Browser route                           | `app/(web)/<route>/page.tsx`            |
| Screen                                  | `app/screens/<name>/`                   |
| UI used only by one screen              | `app/screens/<name>/components/<name>/` |
| Pure screen-specific logic              | `app/screens/<name>/lib/`               |
| Storefront-wide UI                      | `app/shared/components/<name>/`         |
| Cross-application form controls         | `packages/ui/src/components/<name>/`    |
| Reusable React hooks                    | `app/shared/hooks/`                     |
| Shared styles                           | `app/shared/styles/`                    |
| Reused constants                        | `app/shared/constants/`                 |
| Reused domain interfaces                | `app/shared/interface/`                 |
| Reused browser-safe utilities           | `app/shared/utils/`                     |
| Backend request functions               | `app/shared/api/requests/`              |
| Frontend API request and response types | `app/shared/api/types/`                 |

Create optional directories when real code needs them. Keep business-specific logic
close to its screen until multiple consumers justify sharing it.

Use the shared `Select` component for single-value dropdowns. Pass `value`,
`options`, and `onValueChange`, and provide an accessible label. It owns the
styled list, keyboard navigation, and dismissal behavior. Use `DropdownTrigger`
for dropdowns with custom content, such as price fields or multiple taste filters,
so their button and chevron match the select.

`Input` forwards native input props and refs. Catalog search and price filters use
it as controlled fields, so their existing query and validation behavior remains
in their screen hooks.

`useWindowSizeHook` from `@/app/shared/hooks` returns the current viewport `width`
and `height` in CSS pixels and updates them on window resize. Both values are
`null` during server rendering and the initial hydration render. Keep layout
breakpoints in CSS Modules; use this hook when component behavior needs the
viewport dimensions.

## Backend integration

The NestJS backend remains in `apps/backend`. Add explicit endpoint functions in
`app/shared/api/requests/` when the first frontend feature needs backend data. Keep
HTTP details there and UI state in the owning hook. Do not create a generic API
client in advance, duplicate the NestJS API in Next.js, or import backend services,
database models, environment secrets, or server-only utilities into browser code.

## Validation

From the monorepo root:

```sh
pnpm --filter client lint
pnpm --filter client typecheck
pnpm --filter client build
pnpm exec prettier apps/client --check
```
