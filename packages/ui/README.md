# Shared UI

Private source package consumed by the storefront and admin Next.js apps.

Import controls by name: `@mokuren/ui/button`, `@mokuren/ui/select`,
`@mokuren/ui/dropdown-trigger`, and `@mokuren/ui/input`.

Import `@mokuren/ui/tokens.css` once from each app's global stylesheet. It provides
the existing storefront colors, radii, and shadow. Typography and resets remain
app-specific. The package owns four reusable controls: Button, Select,
DropdownTrigger, and Input. Input forwards native input props and refs, so it
works as a controlled or uncontrolled field. The storefront uses it for catalog
search and price filters. Storefront-specific components, navigation, and hooks
remain in `apps/client`.

The package ships TypeScript and CSS Modules directly. Consumers use Next.js
`transpilePackages`; no separate build output is needed. Run its lint/typecheck
and both consumers' production builds after changing shared components.

Screen-specific components, query state, and backend logic stay in applications.
