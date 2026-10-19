# Backend module conventions

Use this guide when adding or changing code in `apps/backend/src`. The backend
uses feature modules: products, media assets, inventory, audit, and authentication.
Keep each feature's implementation together and keep its primary files flat.

## File layout

The products module is the reference for a feature with substantial persistence
and separate public and administrative endpoints:

```text
products/
  products.module.ts
  products.controller.ts
  admin-products.controller.ts
  products.service.ts
  product-catalog.service.ts
  products.repository.ts
  product.mapper.ts
  products.types.ts
  domain/
    product-availability.ts
    product-price.ts
    product-publication.ts
    product-status.ts
  dto/
    create-product.dto.ts
    update-product.dto.ts
    create-product-variant.dto.ts
    update-product-variant.dto.ts
    admin-products-query.dto.ts
    product-catalog-query.dto.ts
    admin-product-response.dto.ts
    public-product-response.dto.ts
  schemas/
    product.schema.ts
    product-variant.schema.ts
```

Keep controllers, services, repositories, mappers, types, integration adapters,
and command entry points at the module root. Do not create `controllers/`,
`services/`, `repositories/`, `mappers/`, or `catalog/` just to classify these
files. A second service is appropriate when it owns a distinct responsibility,
as `ProductCatalogService` does for storefront reads.

Create only the files a feature actually needs. A small module such as audit or
inventory can keep straightforward persistence in its service until separating
it improves readability or reuse. A health endpoint does not need an empty
service, repository, and types file.

The media module follows the same layout. Its root also contains
`cloudinary.service.ts`, `media-asset.mapper.ts`, and
`media-assets-reconcile.cli.ts`. Its pure image-format detector lives in
`utils/detect-image-format.ts`.

## Naming

Use kebab-case for the descriptive part and a dot before the role:

| Role                        | Example                         |
| --------------------------- | ------------------------------- |
| Module                      | `media-assets.module.ts`        |
| Controller                  | `admin-products.controller.ts`  |
| Service                     | `product-catalog.service.ts`    |
| Repository                  | `products.repository.ts`        |
| Mapper                      | `product.mapper.ts`             |
| Shared types and interfaces | `products.types.ts`             |
| Request or response DTO     | `create-product.dto.ts`         |
| Mongoose schema             | `product.schema.ts`             |
| Guard                       | `admin-auth.guard.ts`           |
| Decorator                   | `current-admin.decorator.ts`    |
| CLI entry point             | `media-assets-reconcile.cli.ts` |

Files without a framework or architectural role keep descriptive kebab-case
names, such as `product-price.ts`, `detect-image-format.ts`, and `environment.ts`.
Do not rename existing tests merely to match a source-file suffix; the current
Node.js test suite uses `*.test.mjs`.

Use direct ESM imports with the emitted `.js` extension, even in TypeScript.
Do not add barrel `index.ts` files solely to shorten imports. Use `import type`
for erased contracts; Nest-injected classes and decorated DTO classes need
runtime imports.

## Responsibilities

- **Controller:** HTTP routes, request DTOs, guards, response metadata, and
  delegation to a service. Keep database queries and business decisions out.
- **Service:** business scenarios, validation of domain rules, coordination
  between features, audit events, and transaction boundaries. A service can use
  another module's exported service, never its internal repository or model.
- **Repository:** concrete database queries, filters, sorting, aggregation,
  conditional updates, and persistence. Return results or absence; the service
  decides what HTTP/domain error absence or a failed condition means. Do not
  expose a Mongoose query builder for callers to finish outside the repository.
- **Mapper:** synchronous conversion of loaded records into internal structures
  or explicit API views. No queries or external calls. Keep public and admin
  field allowlists explicit so internal fields cannot leak to the storefront.
- **Module:** register schemas, controllers, and providers. Export only services
  needed by other features; repositories remain private providers.
- **Integration service:** contain calls to a specific external provider.
  `CloudinaryService` stays inside media assets because that feature owns it.
- **CLI:** bootstrap the application, select a command, call a service, and close
  the application. Keep business and persistence logic in the feature.

Repositories are concrete classes, not a generic CRUD framework. Prefer methods
that describe an operation, such as `findPublishedBySlug`, `listCatalog`, or
`claimDeletion`. Do not add a `BaseRepository`, an interface per service, or a
provider abstraction without an actual need.

Repositories may return hydrated Mongoose documents within their own feature.
The service can apply business changes to a document and pass it to the repository
for saving. This is a persistence boundary, not a database-independent domain
model; avoid additional model copies solely to hide Mongoose.

Products currently reads the taste-note reference collection through its
repository. Media assets reads product references there for usage checks and
maintenance. Categories are read through the exported CategoriesService, and
product category bindings are protected by the reference-lock protocol. These
existing cross-collection queries are explicit exceptions; when those feature
boundaries grow, expose the necessary operations through services rather than
importing another module's repository.

## Types and interfaces

Put contracts shared by multiple implementation files in `<feature>.types.ts`.
Keep `type` aliases and `interface` declarations together; do not create a
separate `interfaces.ts` or an application-wide catch-all types file.

For example, `LoadedProduct`, `LoadedVariant`, `LoadedImage`, `LoadedStock`, and
product view types live in `products.types.ts`. Upload input, resolved images,
media views, and Cloudinary result contracts live in `media-assets.types.ts`.
The guard, decorator, and controllers share `AdminRequestUser` from `auth.types.ts`.

Keep a type beside its owner when it is local to one implementation, such as
`StoredVariant` in the product service, `CatalogPage` in the catalog service,
`StockLevels` in inventory, or `AuditEntry` in audit. Move it when another
implementation needs to import it, not just because it is exported.

Keep these definitions with their existing specialized owners:

- DTO classes, validation decorators, and Swagger metadata in `dto/`.
- Mongoose document types and schema-specific values in `schemas/`.
- Domain types and their rules together in `domain/`, such as `ProductPrice`.

A TypeScript interface does not replace a runtime DTO class. Avoid defining a
second identical contract in `*.types.ts` when an existing type already fits.

## Domain code and utilities

`domain/` contains business concepts and pure rules: price representation,
availability, and publication readiness. Keep rules independent of controllers,
services, and external calls.

`utils/` contains focused technical functions, such as identifying image magic
bytes. It is not a destination for all code removed from a service. Keep small
single-use helpers in their owning file unless extraction improves readability
or testability. Do not promote feature-specific helpers to a shared directory
without real consumers in multiple features.

## Transactions and behavior preservation

The service starts and ends the transaction around the whole business scenario.
Pass the same `ClientSession` to all participating repositories and services,
including inventory, media usage counters, and audit. Repositories must not start
independent transactions or silently omit a supplied session.

Preserve conditional update filters and inspect their results. The media deletion
claim and usage increments protect against concurrent product binding and image
deletion; replacing them with unconditional saves changes behavior.

Keep external network calls outside database transactions. Media upload persists
an `uploading` record before calling Cloudinary; reconciliation handles incomplete
uploads and deletions. Preserve this order when reorganizing code.

## Adding or changing a module

1. Start with the module and the files required for its actual responsibilities.
   Keep them at the feature root and add specialized folders only as needed.
2. Define request validation and response fields in `dto/`; put persistence
   definitions in `schemas/` and reusable business rules in `domain/`.
3. Implement the scenario in a service. Use a concrete repository when database
   work is substantial or shared by multiple services.
4. Put shared implementation contracts in `<feature>.types.ts`. Keep local types
   and helpers with their implementation.
5. Register providers and exports, then update callers, tests, documentation,
   and package command paths after any rename.
6. Verify from the monorepo root:

   ```sh
   pnpm --filter @mokuren/backend lint
   pnpm --filter @mokuren/backend typecheck
   pnpm --filter @mokuren/backend build
   pnpm --filter @mokuren/backend test
   pnpm --filter @mokuren/backend test:integration
   ```

The tests import compiled files, so build before running them. Integration tests
use a real in-memory MongoDB replica set and replace Cloudinary with a test
provider; they validate API behavior and persistence, not live Cloudinary calls.
