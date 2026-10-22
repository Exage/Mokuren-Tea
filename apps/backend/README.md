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
| `SESSION_COOKIE_NAME`    | `admin_session`        | HttpOnly admin session cookie                                                        |
| `CSRF_TOKEN_NAME`        | `csrf_token`           | Cookie echoed in `X-CSRF-Token` for cookie-authenticated mutations                   |
| `CORS_ORIGINS`           | Empty                  | Comma-separated exact frontend origins                                              |
| `RATE_LIMIT_MAX`         | `30`                   | Requests per route and IP in one fixed window                                        |
| `RATE_LIMIT_WINDOW_MS`   | `60000`                | Rate limit window in milliseconds                                                    |

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
pnpm --filter @mokuren/backend admin:create
pnpm --filter @mokuren/backend indexes:report
pnpm --filter @mokuren/backend indexes:ensure
pnpm --filter @mokuren/backend content:initialize
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
  app.module.ts                 Configuration, MongoDB connection, feature modules
  config/environment.ts         Environment validation
  health/health.controller.ts    API and database readiness
  auth/                         Admin accounts and MongoDB-backed sessions
  audit/                        Append-only log and protected paginated reads
  categories/                   Category schema, service, repository, and admin/public routes
  products/                     Product cards, variants, publication, public catalog
  inventory/                    Stock records and conditional gram updates
  inventory-movements/          Receipts, write-offs, adjustments and correction history
  idempotency/                  Request keys and replayed results
  reservations/                 Requests, events, numbers and stock transitions
  cms/                          Fixed content blocks, drafts and revisions
  store-settings/               Singleton store contact and location settings
  dashboard/                    Live reservation and stock overview
  media-assets/                 Cloudinary image library, product/CMS bindings, deletion
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
pnpm --filter @mokuren/backend recount:media-usage  # recount product and CMS image usage
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

## Taste notes

`GET /api/taste-notes` returns `{ items }` containing only notes referenced by
published products, including products without available stock. Items contain
`id`, `name`, `slug`, and `sortOrder`. Catalog taste filters retain AND semantics.

All `/api/admin/taste-notes` routes require an active admin session:

```text
GET    /api/admin/taste-notes             paginated (?search, ?page, ?limit)
POST   /api/admin/taste-notes             { name, slug, sortOrder? }
PATCH  /api/admin/taste-notes/:id         { name?, slug?, sortOrder? }
GET    /api/admin/taste-notes/:id/usages  { productsCount }
DELETE /api/admin/taste-notes/:id         { deletedTasteNoteId, affectedProductsCount }
```

Slugs are trimmed, lowercased, and unique. Names need not be unique. Renaming
does not change the slug. Deletion removes the ID from products of every status
in the same transaction as the note deletion and audit event. Product bindings
and deletion acquire reference writes on the same note to prevent dangling links.

### Existing data and production rollout

Stop application writes before migration. Build, then run these commands from
`apps/backend` before enabling the new API against an existing database:

```sh
node dist/taste-notes/taste-notes-migration.cli.js report
node dist/taste-notes/taste-notes-migration.cli.js backfill
node dist/taste-notes/taste-notes-migration.cli.js report
```

The CLI loads this directory's `.env` even from another working directory;
process environment values take precedence. It connects without application
models, automatic indexes, or automatic collection creation. `report` is
read-only and identifies missing/invalid technical fields, invalid names/slugs,
normalization collisions, and product references to absent notes.

`backfill` fills only null/missing `createdAt`, `updatedAt`, `sortOrder`, and
`referenceRevision`. It preserves existing values and product links, and is
safe to repeat. Filled timestamps represent migration time, not known original
creation dates. Invalid non-null values and business-data conflicts are reported
for explicit correction rather than overwritten. Resolve every reported issue
before enabling the API; absent/invalid timestamps return
`503 TASTE_NOTES_MIGRATION_REQUIRED` until corrected.

After resolving slug normalization and collisions, create and verify these
indexes before accepting writes in production (`autoIndex` is disabled):

```js
db.tastenotes.createIndex({ slug: 1 }, { unique: true })
db.tastenotes.createIndex({ sortOrder: 1, _id: 1 })
```

## Inventory and reservations

One inventory record belongs to each product, not each pack size. All stock
amounts are integer grams. `physicalGrams >= reservedGrams >= 0` is enforced by
conditional updates. Each change creates an immutable movement in the same
transaction. A manual adjustment sets the **target physical grams** and must
not reduce them below the reserved amount. Manual operations require a reason.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/admin/inventory/:productId/stock` | Exact physical, reserved and available grams |
| GET | `/api/admin/inventory/movements` | Paginated movement history; filter by product, type, reservation, correction or date |
| POST | `/api/admin/inventory/receipt` | `{ productId, grams, reason }` |
| POST | `/api/admin/inventory/write-off` | `{ productId, grams, reason }`, free stock only |
| POST | `/api/admin/inventory/adjust` | `{ productId, targetPhysicalGrams, reason }` |
| POST | `/api/admin/inventory/compensate` | `{ movementId, reason }` |

Stock-mutating routes accept an optional `Idempotency-Key` header. A completed
request with the same key and body replays its saved result; a changed body
returns `409 IDEMPOTENCY_CONFLICT`. A concurrent duplicate can return
`409 IDEMPOTENCY_IN_FLIGHT` and should be retried after the first finishes.
Keys expire after 24 hours. Reservation-linked reserve and release movements
must be changed through the reservation lifecycle; compensation of a completed
movement restores physical stock without reopening the finished reservation.
Keys must contain 8–200 visible ASCII characters. The in-flight and completed
states are stored in MongoDB, so retries remain safe across backend instances.

Public requests use `POST /api/public/reservations` with `source: "website"`,
`customerName`, `customerPhone`, and `lines: [{ productId, variantId, quantity }]`.
Clients should send a unique `Idempotency-Key` for each submission. New requests
check availability but do not reserve stock. A reservation number and immutable
name, weight and price snapshots are stored. Money is calculated in integer
cents and stored as MongoDB Decimal128; API totals are ordinary JSON numbers.
The public form and admin login have independent per-route, per-IP rate limits.
The limiter is in-process; multi-instance deployments need a shared limiter to
enforce one global request budget.

Admin routes require an active session; mutations also require CSRF protection
for cookie sessions:

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/admin/reservations` | Create a new request on behalf of a customer |
| GET | `/api/admin/reservations` | Paginated list with status, source, customer and date filters |
| GET | `/api/admin/reservations/:id` | Reservation and snapshots |
| PATCH | `/api/admin/reservations/:id` | Edit a `new` request |
| GET | `/api/admin/reservations/:id/events` | Event history |
| POST | `/api/admin/reservations/:id/confirm` | Reserve snapshot grams |
| POST | `/api/admin/reservations/:id/ready` | Mark ready without stock change |
| POST | `/api/admin/reservations/:id/complete` | Decrease physical and reserved grams |
| POST | `/api/admin/reservations/:id/cancel` | Release reserve; `ready` requires `{ teaReturned: true }` |

Allowed transitions are `new → confirmed → ready → completed`, plus cancellation
from `new`, `confirmed`, or `ready`. Completed and cancelled requests are final.
At confirmation stock is checked again; `409 INSUFFICIENT_STOCK` leaves the
request and all product reserves unchanged. Changes to a product never alter
the saved price or weight of an existing reservation. Editing a line's quantity
uses its current price; an unchanged line keeps its saved price.

## CMS, media, settings, audit and dashboard

The CMS supports only `home.hero`, `home.testimonials`, `home.featuredTeas`,
`home.visitStore`, `catalog.header`, `about.content`, and `contacts.content`.
Each block has one shared draft and a separately published value. The draft
write requires `expectedDraftVersion`; a stale value returns
`409 STALE_VERSION`. Publishing one block writes a permanent revision.
Restoring a revision changes the draft only. Featured teas reference 1–4
published products by ID; a featured product must be removed from the
published block before it can be archived.

Public published-only reads:

```text
GET /api/public/cms/pages/:pageKey
GET /api/public/cms/pages/:pageKey/blocks/:blockKey
GET /api/public/store-settings
```

Protected editorial routes:

```text
GET   /api/admin/cms/blocks
GET   /api/admin/cms/blocks/:pageKey/:blockKey
PATCH /api/admin/cms/blocks/:pageKey/:blockKey/draft
POST  /api/admin/cms/blocks/:pageKey/:blockKey/publish
GET   /api/admin/cms/blocks/:pageKey/:blockKey/revisions
POST  /api/admin/cms/blocks/:pageKey/:blockKey/revisions/:revisionId/restore
GET   /api/admin/cms/preview/:pageKey/:blockKey
GET   /api/admin/store-settings
PATCH /api/admin/store-settings
GET   /api/admin/audit
GET   /api/admin/dashboard
```

CMS content uses validated plain text and media asset IDs. Image deletion
checks product cards, CMS drafts, published blocks and old revisions. The media
usage recount covers all of them. Audit reads are paginated and filtered by
actor, action, entity and date. Dashboard calculates live status and stock
counts and is available only to admins.

## Existing-database rollout

Build first. Stop writes before index creation or media usage recount. Use an
authenticated transaction-capable MongoDB replica set in production.

```sh
pnpm --filter @mokuren/backend indexes:report
pnpm --filter @mokuren/backend indexes:ensure
pnpm --filter @mokuren/backend content:initialize
pnpm --filter @mokuren/backend recount:media-usage
```

`indexes:report` is read-only. It reports duplicate values that would prevent
unique indexes and counts nonzero inventory records with no movement history.
Resolve duplicates before `indexes:ensure`. The latter explicitly creates the
indexes for the new collections because production disables automatic index
creation. `content:initialize` creates the seven fixed CMS block records and
the `Mokuren Tea` store settings document. It can be repeated without
overwriting admin edits. It does not publish placeholder content or invent
stock movements. If existing nonzero stock lacks movements, preserve it and
record the known opening balance separately before relying on movement history.

All new routes and request DTOs are visible in Swagger at `/api/docs` when the
API is running. Integration tests need a local MongoDB replica set and use an
in-memory one by default.

Validation failures return `400 VALIDATION_ERROR` with a `details` array of
fields and messages. Auth failures return `401 UNAUTHORIZED`; cookie session
mutations also require a CSRF token. Domain conflicts return `409` with a
specific code such as `INSUFFICIENT_STOCK`, `INVALID_STATUS_TRANSITION`,
`STALE_VERSION`, `MEDIA_ASSET_IN_USE`, `IDEMPOTENCY_CONFLICT`, or
`IDEMPOTENCY_IN_FLIGHT`. Exceeding the public form or login limit returns
`429 RATE_LIMITED`. Swagger documents the success and error status codes for
the new reservation, stock, CMS, settings, audit, and dashboard routes.

Integration reference: [NestJS MongoDB documentation](https://docs.nestjs.com/techniques/mongodb).
