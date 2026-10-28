# Administrative API and implementation plan

Reviewed against the current NestJS controllers and DTOs in `apps/backend/src`,
with the workspace documents `MOKUREN_TEA_BACKEND.md` and
`MOKUREN_TEA_PRODUCTS.md` as product context. Session authentication and the products, media, categories, taste notes, and
inventory interfaces are implemented. Other feature integrations remain planned.

All paths below are relative to `/api`. Inspect live Swagger at
`http://localhost:3001/api/docs` when the backend is running.

## Screens supported by existing controllers

| Screen                       | Implemented API routes                                                                                                                                                                                                                                                                                                      | UI scope                                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Overview `/`                 | `GET /admin/dashboard`                                                                                                                                                                                                                                                                                                      | New, confirmed, ready counts; low/out-of-stock counts; recent active reservations; problematic products; manual refresh |
| Products `/products`         | `GET/POST /admin/products`, `GET/PATCH /admin/products/:id`, `POST /:id/publish`, `POST /:id/archive`, `POST /:id/variants`, `PATCH /:id/variants/:variantId` under the same prefix                                                                                                                                         | Search, status filter, pagination, product editor, publication checks, variant management                               |
| Reservations `/reservations` | `GET/POST /admin/reservations`, `GET/PATCH /admin/reservations/:id`, `GET /:id/events`, `POST /:id/confirm`, `/ready`, `/complete`, `/cancel` under the same prefix                                                                                                                                                         | List, detail, new-request editing, transitions, event timeline                                                          |
| Inventory `/inventory`       | `GET /admin/inventory/:productId/stock`, `GET /admin/inventory/movements`, `POST /admin/inventory/receipt`, `/write-off`, `/adjust`, `/compensate`                                                                                                                                                                          | Product stock, movement history, receipt, write-off, stock count, compensation                                          |
| Categories `/categories`     | `GET/POST /admin/categories`, `PATCH /admin/categories/:id`, `POST /admin/categories/:id/move-and-delete`                                                                                                                                                                                                                   | Dictionary editor, reorder through sortOrder, transfer products before deletion                                         |
| Taste notes `/taste-notes`   | `GET/POST /admin/taste-notes`, `PATCH/DELETE /admin/taste-notes/:id`, `GET /admin/taste-notes/:id/usages`                                                                                                                                                                                                                   | Dictionary editor and usage-aware deletion                                                                              |
| Content `/content`           | `GET /admin/cms/blocks`, `GET /admin/cms/blocks/:pageKey/:blockKey`, `PATCH /blocks/:pageKey/:blockKey/draft`, `POST /blocks/:pageKey/:blockKey/publish`, `GET /blocks/:pageKey/:blockKey/revisions`, `POST /blocks/:pageKey/:blockKey/revisions/:revisionId/restore`, `GET /preview/:pageKey/:blockKey` under `/admin/cms` | Fixed block forms, draft versions, preview, publication, revision restoration                                           |
| Media `/media`               | `GET/POST /admin/media-assets`, `GET/PATCH/DELETE /admin/media-assets/:id`, `GET /admin/media-assets/:id/usages`                                                                                                                                                                                                            | Library, upload, name/alt editor, usage checks                                                                          |
| Settings `/settings`         | `GET/PATCH /admin/store-settings`                                                                                                                                                                                                                                                                                           | Name, tagline, address, hours, phone, contacts                                                                          |
| Administrators `/users`      | `GET/POST /admin/users`, `PATCH /admin/users/:id`, `POST /:id/reset-password`, `POST /:id/revoke-sessions` under the same prefix                                                                                                                                                                                            | Accounts, active status, password reset, session revocation                                                             |
| Audit `/audit`               | `GET /admin/audit`                                                                                                                                                                                                                                                                                                          | Filtered, paginated read-only event history                                                                             |

## Authentication (implemented)

1. Request `GET /admin/auth/csrf-token` with credentials. It returns **204**, sets
   the `csrf_token` cookie, and has no JSON body.
2. Send `POST /admin/auth/login` with `login`, `password`, cookies, and the cookie's
   value in `X-CSRF-Token`. The session is an HttpOnly cookie, not a JSON token.
3. Read `GET /admin/auth/me`. Honor `mustChangePassword` and implement
   `POST /admin/auth/change-password` before allowing ordinary admin features.
4. Use `POST /admin/auth/logout` to revoke the current session. Handle 401,
   `PASSWORD_CHANGE_REQUIRED`, CSRF errors, validation errors, and throttling.
5. Every cookie-authenticated mutation carries the CSRF header. Never persist a
   session token in localStorage or use a hardcoded login bypass.

The admin uses a same-origin proxy: `/api/admin/:path*` forwards to the server's
`ADMIN_API_URL` (default `http://127.0.0.1:3001/api`). Browser requests include
credentials and do not require a CORS change. Cookies must apply to the admin
host; leave the backend cookie domain unset for host-only cookies. Production
uses HTTPS for Secure cookies. Server-side session checks forward only the
session cookie directly to the same API root, disable caching, and run in every
protected screen before rendering. Authentication transitions discard the
browser router cache. No backend environment or API contract changes are needed.

## Differences from the planning documents

- Dashboard is `/admin/dashboard`, not `/admin/dashboard/overview`.
- Media uses `/admin/media-assets`; upload is a multipart `POST` with a `file`
  field and optional `name`/`alt`. There are no upload-signature or complete-upload
  endpoints in the current controller.
- Stock mutations take `productId` in the body. Adjustment takes
  `targetPhysicalGrams`; compensation takes `movementId`. Reasons are required.
  There is no `GET /admin/inventory` collection endpoint. Start with product lookup
  and per-product stock; evaluate a paginated stock endpoint before building a large
  inventory table instead of issuing an unbounded request per product.
- CMS uses `/blocks/` in resource paths and `PATCH` for drafts. Preview is for a
  selected block. Send the exact page/block keys returned by the API (block keys
  are qualified, such as `home.hero`), and honor `expectedDraftVersion` conflicts.
- Product DTOs accept `description`, category/taste/image IDs, threshold, and
  variants. Separate origin, short description, full description, and tasting-profile
  fields in the product document are not all implemented as independent API fields.
  Do not add editable controls that silently discard unsupported fields.
- Variant prices use numeric `price` in BYN, not the document's `priceMinor`.
  Do not create seed imports as part of scaffolding. The twelve proposed products,
  prices, origins, and thresholds are demo content, not live inventory.

## Suggested delivery sequence

1. Session login/logout, current user, forced password change, protected screens,
   and real overview with loading/error/empty states.
2. Media, categories, taste notes, products and variants. Published product edits
   take effect immediately; make that clear in the editor. Draft publication needs
   valid category, image, and enabled priced variant.
3. Inventory operations and reservation lifecycle. Treat server stock and totals
   as authoritative; show conflicts and prevent duplicate submissions. New stock
   comes through receipts, not by editing reserved grams.
4. CMS fixed blocks, version conflicts and previews; store settings.
5. Administrator management and audit browsing.

Keep automatic payments, deliveries, customer accounts, email/Telegram alerts,
freeform page building, polling, and automatic reservation expiry outside this scope.

## Implemented catalog interfaces

Products, media, dictionaries, and inventory now use the routes above with real
loading, empty, error, and success feedback. Lists and reference pickers support
pagination and search. Product status changes, dictionary/image deletion, and
stock movements have a review step. The backend remains authoritative for
publication checks, references, stock arithmetic, and concurrency. Archived
products cannot be republished. The media library displays ready assets.

Inventory mutation retries reuse an operation key after an uncertain response.
Receipt/write-off quantities and stock-count targets use integer grams; reserved
stock is never editable. Compensation is offered for manual receipts, write-offs,
and adjustments; server conflicts explain already compensated or invalid changes.

The remaining delivery sequence is overview/reservations, CMS/settings, then
administrator management and audit browsing.
