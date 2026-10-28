# Shared UI

Private source package consumed by the storefront and admin Next.js apps.

Import controls by name: `@mokuren/ui/button`, `@mokuren/ui/select`,
`@mokuren/ui/dropdown-trigger`, `@mokuren/ui/input`, `@mokuren/ui/checkbox`, and
`@mokuren/ui/textarea`.

Import `@mokuren/ui/tokens.css` once from each app's global stylesheet. It provides
the existing storefront colors, radii, and shadow. Typography and resets remain
app-specific. The package owns six reusable controls: Button, Select,
DropdownTrigger, Input, Checkbox, and Textarea. Input, Checkbox, and Textarea
forward native props and refs, so they work as controlled or uncontrolled fields.
The storefront uses Input for catalog
search and price filters. Admin forms use the shared controls for text, numbers,
files, search, selection, checkboxes, and multiline input. Storefront-specific
components, navigation, and hooks remain in `apps/client`.

The package ships TypeScript and CSS Modules directly. Consumers use Next.js
`transpilePackages`; no separate build output is needed. Run its lint/typecheck
and both consumers' production builds after changing shared components.

Screen-specific components, query state, and backend logic stay in applications.
