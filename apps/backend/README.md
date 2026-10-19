# Mokuren Tea backend

NestJS API using TypeScript, ESM, and MongoDB through `@nestjs/mongoose`.
Run the following commands from the monorepo root with the Node.js version in `.nvmrc`.

## Setup

```sh
pnpm install --frozen-lockfile
cp apps/backend/.env.example apps/backend/.env
pnpm --filter @mokuren/backend db:up
pnpm dev --filter=@mokuren/backend
```

`db:up` requires Docker with Compose running. It starts MongoDB 8.0 as a
single-node replica set (`mokuren-rs`), initializes it automatically on first
startup, and waits until it is ready for writes. Product operations require this
replica set for multi-document transactions.

MongoDB listens on port `27017` inside the container and is exposed only on
`127.0.0.1:27018` on the host, so a local MongoDB on `27017` can keep running.
The connection string for the backend running on the host is:

```text
mongodb://127.0.0.1:27018/mokuren_tea?replicaSet=mokuren-rs&directConnection=true
```

`directConnection=true` keeps the host client on the published endpoint rather
than trying to resolve the replica set's internal `mongodb:27017` address.
See the [MongoDB connection guidance](https://www.mongodb.com/docs/mongodb-shell/connect/).
If the backend later runs in the same Compose network, use `mongodb:27017` instead.

Data persists in the named `mongodb-replica-data` Docker volume across container
restarts and `db:down`. Existing data in a native MongoDB or an older Docker volume
is not migrated automatically. This configuration has no authentication and is
intended for local development only.

For MongoDB Atlas or another existing replica set, skip `db:up` and set
`MONGODB_URI` to its connection string.

## Environment

| Variable                  | Default                | Purpose                                                                              |
| ------------------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| `NODE_ENV`                | `development`          | `development`, `test`, or `production`                                               |
| `PORT`                    | `3001`                 | HTTP port, from 1 to 65535                                                           |
| `MONGODB_URI`             | Required               | MongoDB connection string including the database name                                |
| `CLOUDINARY_CLOUD_NAME`   | Required in production | Cloudinary cloud name for image storage                                              |
| `CLOUDINARY_API_KEY`      | Required in production | Cloudinary API key (server-side only)                                                |
| `CLOUDINARY_API_SECRET`   | Required in production | Cloudinary API secret (never exposed to clients or logs)                             |
| `CLOUDINARY_ASSET_FOLDER` | Required in production | Existing Cloudinary folder (Dynamic folders `asset_folder`) where uploads are placed |

The application loads `.env` from this directory, including when launched from a
different working directory. Process environment variables take precedence.
Configuration is validated at startup: in production the Cloudinary cloud
name, API key, API secret, and asset folder are all required; in development
and test they are optional so the API can boot without secrets (uploads then
return `503`, tests inject a fake uploader). `.env` is ignored by Git.
The Turbo development task forwards these variables when supplied by the shell.

## Commands

```sh
pnpm dev --filter=@mokuren/backend
pnpm build --filter=@mokuren/backend
pnpm --filter @mokuren/backend start
pnpm lint
pnpm typecheck
pnpm --filter @mokuren/backend test:integration
pnpm --filter @mokuren/backend db:status
pnpm --filter @mokuren/backend db:down
```

`start` runs the compiled application; run `build` first. The root `pnpm test`
command builds through Turbo before running the backend's Node.js tests. The
package-level `test` command requires an existing build and covers configuration,
health, and product domain rules without requiring MongoDB. The separate
`test:integration` command runs API tests on an in-memory MongoDB replica set
(transactions included, no Docker needed).
`db:down` stops the local database and retains its data volume.

## Health check

`GET /api/health` sends a MongoDB ping and returns:

```json
{ "status": "ok", "database": "up" }
```

After startup, a database outage returns HTTP 503 with
`{ "status": "error", "database": "down" }`. At startup, MongoDB must be reachable
before HTTP requests are accepted. Connection attempts use bounded timeouts and retries.
Shutdown hooks close the connection when the process receives a termination signal.

## Structure

See [Backend module conventions](./docs/modules.md) for the required file layout,
naming, responsibility boundaries, shared types, and new-module workflow.

```text
src/
  main.ts                       HTTP bootstrap, validation, Swagger, shutdown hooks
  app.module.ts                 Configuration, MongoDB connection, ProductsModule
  config/environment.ts         Environment validation
  health/health.controller.ts    API and database readiness
  auth/                         Minimal real admin session guard (MongoDB-backed)
  audit/                        Append-only audit log written in shared transactions
  categories/                   Category schema, service, repository, and admin/public routes
  products/                     Product cards, variants, publication, public catalog
  inventory/                    Zero-stock creation and stock reads for products
  media-assets/                 Cloudinary image library, product bindings, deletion
test/
  category-slug.test.mjs        Slug/name normalization and sortOrder validation (no MongoDB)
  category-mapper.test.mjs      Public and admin category projections (no MongoDB)
  product-publication.test.mjs  Publication readiness rules (no MongoDB)
  product-availability.test.mjs Availability and minimum price rules (no MongoDB)
  integration/                  API tests on an in-memory MongoDB replica set
```

## Media library

Admin image management lives in `src/media-assets/` (Mongoose collection
`mediaassets`). Cloudinary holds the binaries, MongoDB holds the metadata.
The Cloudinary secret is read only inside `CloudinaryService` and never
appears in API responses, logs, or frontend bundles. All SDK calls stay in
that service; there is no generic storage-provider abstraction. Uploads are
placed into the existing folder configured via `CLOUDINARY_ASSET_FOLDER`
(passed as `asset_folder` for Dynamic folders), while `public_id` is
generated separately and uniquely per asset so files are never overwritten.

Admin routes (all behind the admin session guard):

```text
POST   /api/admin/media-assets        multipart file + optional name and alt -> 201 ready
GET    /api/admin/media-assets        ?search=&status= (default ready), paginated
GET    /api/admin/media-assets/:id
PATCH  /api/admin/media-assets/:id    { name?, alt? }
GET    /api/admin/media-assets/:id/usages   products referencing the image
DELETE /api/admin/media-assets/:id    202, then GET polls deleting -> deleted
```

New uploads are resized to 558 pixels wide by Cloudinary, preserving aspect ratio.

Rules: one file per request; JPEG, PNG, WebP verified by magic bytes
(unsupported -> `415`); 10 MiB per-file limit (`413` when exceeded,
enforced by the multipart parser before buffering completes).
`DELETE` on a used image returns `409 MEDIA_ASSET_IN_USE`. Missing
Cloudinary resources count as successful deletion; CDN invalidation is not
instant. Product cards keep `imageIds` order (first = cover); the admin
view adds resolved `images`, the public catalog returns optimized Cloudinary
URLs (`f_auto,q_auto`, fixed `w_800` catalog / `w_1600` detail presets, no
client-supplied transformations) with `width`/`height`.

## Categories

Categories are identified by a unique, normalized slug. Display names are not
unique, and there is no `normalizedName` field. Slugs are trimmed and lowercased
before validation and persistence (`"  OOLONG  "` becomes `"oolong"`). Renaming a
category does not change its slug; an explicit slug change normalizes identically.

Public discovery (`GET /api/categories`, no session) shows only categories
referenced by at least one published product; inventory availability does not
affect visibility.

Admin routes (all behind the admin session guard):

```text
GET    /api/categories                         public list (visible categories only)
GET    /api/admin/categories                   paginated (?search, ?page, ?limit)
POST   /api/admin/categories                   { name, slug, sortOrder? } -> 201
PATCH  /api/admin/categories/:id               { name?, slug?, sortOrder? } -> 200
POST   /api/admin/categories/:id/move-and-delete { targetCategoryId? } -> 200
```

Slugs are protected by a unique index; a duplicate normalized slug returns
`409 CONFLICT`. Deleting a category that still references products requires
`targetCategoryId`; every referencing product (all statuses) moves to the target
and the source is removed atomically with audit. An empty category may be
deleted without a target, returning `targetCategoryId: null` and count `0`.

### Legacy data compatibility

Existing category documents may lack `createdAt`, `updatedAt`, `sortOrder`, or
`referenceRevision` (raw inserts before this feature existed). Before the
category API serves existing records, run the read-only migration report to
diagnose, then the repeatable backfill to fill missing technical defaults:

```sh
# 1. Read-only diagnosis (no data is modified)
node dist/categories/categories-migration.cli.js report

# 2. Backfill missing timestamps and technical fields on legacy records
node dist/categories/categories-migration.cli.js backfill
```

The backfill is idempotent: valid fields are never rewritten, and repeated runs
are safe. Backfill timestamps are migration-time values, not known original
creation dates.


Service commands (run `build` first):

```sh
pnpm --filter @mokuren/backend reconcile:media   # adopt or fail stuck uploading, finish deleting
pnpm --filter @mokuren/backend recount:media-usage  # one-time usageCount recount from Product.imageIds
node dist/categories/categories-migration.cli.js   # read-only pre-migration report
node dist/categories/categories-migration.cli.js backfill   # backfill legacy category technical fields
```

Run `recount:media-usage` once after deploying, before relying on delete
guards for pre-existing data. Schedule or run `reconcile:media` manually
after Cloudinary outages or timed-out uploads.

Production indexes (`autoIndex` is disabled in production) — create once:

```js
db.mediaassets.createIndex({ publicId: 1 }, { unique: true })
db.mediaassets.createIndex({ status: 1, createdAt: -1 })
db.mediaassets.createIndex({ status: 1, updatedAt: 1 })
db.mediaassets.createIndex({ originalName: 1 })
db.mediaassets.createIndex({ cloudinaryAssetId: 1 }, { sparse: true })
```

Category indexes — create the unique slug index only after confirming there are
no normalization collisions (run the migration report first), then verify it
exists before enabling category writes:

```js
db.categories.createIndex({ slug: 1 }, { unique: true })
db.categories.createIndex({ sortOrder: 1, _id: 1 })
```

Add business modules and Mongoose schemas when their requirements are defined.
In production, supply deployment environment variables and use an authenticated
MongoDB service. Automatic index creation is disabled in production; manage indexes
explicitly when introducing schemas.

Integration reference: [NestJS MongoDB documentation](https://docs.nestjs.com/techniques/mongodb).
