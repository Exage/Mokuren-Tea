# Backend rules

Read [Module conventions](./docs/modules.md) before adding or reorganizing backend modules.
It is the source of truth for the backend's file layout and responsibility boundaries.

- Keep controllers, services, repositories, mappers, shared types, integrations,
  and CLI entry points at the feature root. Do not add folders for each role.
- Use kebab-case descriptive names followed by a dot-separated role:
  `products.module.ts`, `admin-products.controller.ts`, `products.types.ts`.
- Reserve `dto/`, `schemas/`, `domain/`, and `utils/` for their documented purposes.
- Extract shared types into `<feature>.types.ts`; retain local types with their
  implementation and domain/schema types with their owners.
- Add repositories for substantial persistence, not as mandatory empty layers.
  Keep repositories private to their module and coordinate transactions in services.
- Preserve routes, response fields, validation, session propagation, and conditional
  concurrency guards when restructuring code.
- Update all imports, tests, documentation, and CLI paths after renaming files.
- Build before running tests because they import `dist/`.
