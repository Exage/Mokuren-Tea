import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { env, execPath } from 'node:process'
import { after, before, test } from 'node:test'
import { promisify } from 'node:util'
import { fileURLToPath, URL } from 'node:url'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Types } from 'mongoose'
import request from 'supertest'
import { CmsService } from '../../dist/cms/cms.service.js'
import { StoreSettingsService } from '../../dist/store-settings/store-settings.service.js'
import { createAdmin, seedReferences, startTestApp, stopTestApp } from './setup.mjs'

let app
let replSet
let db
let refs
let token
let csrfToken
const runFile = promisify(execFile)
const contentCli = fileURLToPath(
  new URL('../../dist/cms/content-initialize.cli.js', import.meta.url)
)
const indexesCli = fileURLToPath(new URL('../../dist/database/indexes.cli.js', import.meta.url))

before(async () => {
  const started = await startTestApp('mokuren_content_dashboard_test')
  ;({ app, replSet, db } = started)
  refs = await seedReferences(db)
  ;({ token } = await createAdmin(db))
  const csrf = await request(app.getHttpServer()).get('/api/admin/auth/csrf-token')
  const cookies = Array.isArray(csrf.headers['set-cookie'])
    ? csrf.headers['set-cookie']
    : [csrf.headers['set-cookie']]
  csrfToken = cookies.map((value) => value?.match(/^csrf_token=([^;]*)/)?.[1]).find(Boolean)
  assert.ok(csrfToken)
})

after(async () => {
  await stopTestApp(app, replSet)
})

function headers() {
  return {
    cookie: `admin_session=${token}; csrf_token=${csrfToken}`,
    'x-csrf-token': csrfToken,
  }
}

test('CMS initialization is repeatable and draft versions reject stale saves', async () => {
  const service = app.get(CmsService)
  await service.initializeFixedBlocks(null)
  await service.initializeFixedBlocks(null)
  assert.equal(await db.collection('cmsblocks').countDocuments({}), 7)

  const route = '/api/admin/cms/blocks/home/home.hero/draft'
  const first = await request(app.getHttpServer())
    .patch(route)
    .set(headers())
    .send({
      pageKey: 'home',
      blockKey: 'home.hero',
      expectedDraftVersion: 0,
      content: { title: 'First draft' },
    })
  assert.equal(first.status, 200, JSON.stringify(first.body))
  assert.equal(first.body.draftVersion, 1)

  const stale = await request(app.getHttpServer())
    .patch(route)
    .set(headers())
    .send({
      pageKey: 'home',
      blockKey: 'home.hero',
      expectedDraftVersion: 0,
      content: { title: 'Stale draft' },
    })
  assert.equal(stale.status, 409)
  assert.equal(stale.body.code, 'STALE_VERSION')
})

test('published contacts expose configured map coordinates, without exposing a draft', async () => {
  const route = '/api/admin/cms/blocks/contacts/contacts.content'
  const content = {
    title: 'Visit us',
    address: 'Tea Street',
    phone: '+375291234567',
    email: 'tea@example.com',
    hours: 'Daily',
    location: { latitude: 53.9, longitude: 27.56 },
  }
  const draft = await request(app.getHttpServer()).patch(`${route}/draft`).set(headers()).send({
    pageKey: 'contacts', blockKey: 'contacts.content', expectedDraftVersion: 0, content,
  })
  assert.equal(draft.status, 200, JSON.stringify(draft.body))
  const before = await request(app.getHttpServer()).get('/api/public/cms/pages/contacts')
  assert.equal(before.body.blocks['contacts.content'].content, null)
  await request(app.getHttpServer()).post(`${route}/publish`).set(headers()).send({
    pageKey: 'contacts', blockKey: 'contacts.content',
  }).expect(201)
  const published = await request(app.getHttpServer()).get('/api/public/cms/pages/contacts')
  assert.deepEqual(published.body.blocks['contacts.content'].content.location, content.location)
})

test('CMS preview keeps other blocks published and restore changes only draft', async () => {
  const hero = '/api/admin/cms/blocks/home/home.hero'
  const publish = await request(app.getHttpServer()).post(`${hero}/publish`).set(headers()).send({
    pageKey: 'home',
    blockKey: 'home.hero',
  })
  assert.equal(publish.status, 201, JSON.stringify(publish.body))
  assert.equal(publish.body.published.title, 'First draft')

  const second = await request(app.getHttpServer())
    .patch(`${hero}/draft`)
    .set(headers())
    .send({
      pageKey: 'home',
      blockKey: 'home.hero',
      expectedDraftVersion: 1,
      content: { title: 'Second draft' },
    })
  assert.equal(second.status, 200, JSON.stringify(second.body))

  const preview = await request(app.getHttpServer())
    .get('/api/admin/cms/preview/home/home.hero')
    .set(headers())
  assert.equal(preview.status, 200)
  assert.equal(preview.body.blocks['home.hero'].title, 'Second draft')

  const publicPage = await request(app.getHttpServer()).get('/api/public/cms/pages/home')
  assert.equal(publicPage.body.blocks['home.hero'].content.title, 'First draft')

  const revisions = await request(app.getHttpServer()).get(`${hero}/revisions`).set(headers())
  assert.equal(revisions.status, 200)
  const revisionId = revisions.body.items[0].id
  const restore = await request(app.getHttpServer())
    .post(`${hero}/revisions/${revisionId}/restore`)
    .set(headers())
    .send({
      pageKey: 'home',
      blockKey: 'home.hero',
      revisionId,
    })
  assert.equal(restore.status, 201, JSON.stringify(restore.body))
  assert.equal(restore.body.draft.title, 'First draft')
  assert.equal(restore.body.published.title, 'First draft')
  assert.equal(restore.body.draftVersion, 3)
})

test('CMS media reference prevents deletion and featured product cannot be archived', async () => {
  const hero = '/api/admin/cms/blocks/home/home.hero'
  const saveImage = await request(app.getHttpServer())
    .patch(`${hero}/draft`)
    .set(headers())
    .send({
      pageKey: 'home',
      blockKey: 'home.hero',
      expectedDraftVersion: 3,
      content: { title: 'With photo', imageId: refs.imageId },
    })
  assert.equal(saveImage.status, 200, JSON.stringify(saveImage.body))
  const beforePublish = await request(app.getHttpServer()).get('/api/public/cms/pages/home')
  assert.equal(beforePublish.body.blocks['home.hero'].image, null)
  const rawAsset = await db
    .collection('mediaassets')
    .findOne({ _id: new Types.ObjectId(refs.imageId) })
  assert.ok(rawAsset.usageCount > 0)
  const blockedDelete = await request(app.getHttpServer())
    .delete(`/api/admin/media-assets/${refs.imageId}`)
    .set(headers())
  assert.equal(blockedDelete.status, 409, JSON.stringify(blockedDelete.body))

  const product = await request(app.getHttpServer())
    .post('/api/admin/products')
    .set(headers())
    .send({
      name: 'Featured Tea',
      slug: 'featured-tea',
      categoryId: refs.categoryId,
      imageIds: [refs.imageId],
      variants: [{ weightGrams: 50, price: 21.9, enabled: true }],
    })
  assert.equal(product.status, 201, JSON.stringify(product.body))
  await request(app.getHttpServer())
    .post(`/api/admin/products/${product.body.id}/publish`)
    .set(headers())
    .expect(201)

  const feature = '/api/admin/cms/blocks/home/home.featuredTeas'
  await request(app.getHttpServer())
    .patch(`${feature}/draft`)
    .set(headers())
    .send({
      pageKey: 'home',
      blockKey: 'home.featuredTeas',
      expectedDraftVersion: 0,
      content: { teaIds: [product.body.id] },
    })
    .expect(200)
  await request(app.getHttpServer())
    .post(`${feature}/publish`)
    .set(headers())
    .send({
      pageKey: 'home',
      blockKey: 'home.featuredTeas',
    })
    .expect(201)
  const publishHero = await request(app.getHttpServer())
    .post(`${hero}/publish`)
    .set(headers())
    .send({
      pageKey: 'home',
      blockKey: 'home.hero',
    })
  assert.equal(publishHero.status, 201, JSON.stringify(publishHero.body))
  const publicPage = await request(app.getHttpServer()).get('/api/public/cms/pages/home')
  assert.equal(publicPage.status, 200)
  assert.equal(publicPage.body.blocks['home.hero'].image.id, refs.imageId)
  assert.ok(publicPage.body.blocks['home.hero'].image.url)
  const featured = publicPage.body.blocks['home.featuredTeas']
  assert.deepEqual(
    featured.products.map((item) => item.id),
    [product.body.id]
  )
  assert.equal(featured.products[0].slug, 'featured-tea')
  assert.equal(featured.products[0].variants[0].price, 21.9)
  assert.equal(featured.products[0].stock, undefined)
  const publicBlock = await request(app.getHttpServer()).get(
    '/api/public/cms/pages/home/blocks/home.featuredTeas'
  )
  assert.deepEqual(publicBlock.body, featured)

  const archive = await request(app.getHttpServer())
    .post(`/api/admin/products/${product.body.id}/archive`)
    .set(headers())
  assert.equal(archive.status, 409)
  assert.equal(archive.body.code, 'PRODUCT_FEATURED_IN_CMS')
})

test('settings, audit and dashboard require the right access and reflect state', async () => {
  const settingsService = app.get(StoreSettingsService)
  await settingsService.initializeDefaultSettings({ name: 'Mokuren Tea' }, null)
  await settingsService.initializeDefaultSettings({ name: 'Should not overwrite' }, null)
  const settings = await request(app.getHttpServer()).get('/api/public/store-settings')
  assert.equal(settings.body.name, 'Mokuren Tea')

  await request(app.getHttpServer()).get('/api/admin/dashboard').expect(401)
  const overview = await request(app.getHttpServer()).get('/api/admin/dashboard').set(headers())
  assert.equal(overview.status, 200, JSON.stringify(overview.body))
  assert.ok(overview.body.stock)

  await request(app.getHttpServer()).get('/api/admin/audit').expect(401)
  const audit = await request(app.getHttpServer())
    .get('/api/admin/audit?page=1&limit=2')
    .set(headers())
  assert.equal(audit.status, 200, JSON.stringify(audit.body))
  assert.ok(audit.body.pagination.totalItems > 0)
  assert.equal(audit.body.items.length, 2)
  await request(app.getHttpServer()).get('/api/admin/audit?limit=1000').set(headers()).expect(400)
})

test('dashboard counts active requests and separates low stock from out of stock', async () => {
  const before = await request(app.getHttpServer()).get('/api/admin/dashboard').set(headers())
  for (const [slug, grams, publish] of [
    ['dashboard-low', 50, true],
    ['dashboard-out', 0, true],
    ['dashboard-draft', 0, false],
  ]) {
    const created = await request(app.getHttpServer())
      .post('/api/admin/products')
      .set(headers())
      .send({
        name: slug,
        slug,
        categoryId: refs.categoryId,
        imageIds: [refs.imageId],
        variants: [{ weightGrams: 25, price: 1.25, enabled: true }],
        lowStockThresholdGrams: 50,
      })
    assert.equal(created.status, 201, JSON.stringify(created.body))
    if (grams) {
      await request(app.getHttpServer())
        .post('/api/admin/inventory/receipt')
        .set(headers())
        .send({ productId: created.body.id, grams, reason: 'Dashboard fixture' })
        .expect(200)
    }
    if (publish) {
      await request(app.getHttpServer())
        .post(`/api/admin/products/${created.body.id}/publish`)
        .set(headers())
        .expect(201)
    }
  }
  const statuses = ['new', 'confirmed', 'ready', 'completed', 'cancelled']
  await db.collection('reservations').insertMany(
    statuses.map((status, index) => ({
      number: `DASH-${index}`,
      customerName: 'Dashboard customer',
      status,
      totalGrams: 25,
      createdAt: new Date(Date.now() + index),
    }))
  )
  const after = await request(app.getHttpServer()).get('/api/admin/dashboard').set(headers())
  assert.equal(after.status, 200, JSON.stringify(after.body))
  for (const status of ['new', 'confirmed', 'ready']) {
    assert.equal(after.body.reservations[status], before.body.reservations[status] + 1)
  }
  assert.equal(after.body.stock.lowStockProducts, before.body.stock.lowStockProducts + 1)
  assert.equal(after.body.stock.outOfStockProducts, before.body.stock.outOfStockProducts + 1)
  assert.ok(
    after.body.recentReservations.every((item) =>
      ['new', 'confirmed', 'ready'].includes(item.status)
    )
  )
  assert.deepEqual(
    after.body.recentReservations.map((item) => item.number),
    ['DASH-2', 'DASH-1', 'DASH-0']
  )
})

test('OpenAPI describes the actual CMS, audit and dashboard response shapes', () => {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('test').setVersion('1').build()
  )
  const cmsList =
    document.paths['/api/admin/cms/blocks'].get.responses['200'].content['application/json'].schema
  const publicPage =
    document.paths['/api/public/cms/pages/{pageKey}'].get.responses['200'].content[
      'application/json'
    ].schema
  const audit =
    document.paths['/api/admin/audit'].get.responses['200'].content['application/json'].schema
  const dashboard =
    document.paths['/api/admin/dashboard'].get.responses['200'].content['application/json'].schema
  assert.equal(cmsList.$ref, '#/components/schemas/CmsBlockListDto')
  assert.equal(publicPage.$ref, '#/components/schemas/PublishedCmsPageDto')
  assert.equal(audit.$ref, '#/components/schemas/AuditLogListDto')
  assert.equal(dashboard.$ref, '#/components/schemas/DashboardViewDto')
  assert.ok(document.components.schemas.PublishedCmsBlockDto)
  assert.ok(document.paths['/api/admin/reservations'].post.responses['201'])
})

test('compiled initialization and index commands can be repeated without overwriting edits', async () => {
  await db.collection('cmsblocks').deleteMany({})
  await db.collection('storesettings').deleteMany({})
  const options = {
    env: {
      ...env,
      NODE_ENV: 'production',
      MONGODB_URI: replSet.getUri(db.databaseName),
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: 'test-secret',
      CLOUDINARY_ASSET_FOLDER: 'test-folder',
    },
  }
  await runFile(execPath, [indexesCli, 'report'], options)
  await runFile(execPath, [indexesCli, 'ensure'], options)
  await runFile(execPath, [contentCli], options)
  assert.equal(await db.collection('cmsblocks').countDocuments({}), 7)
  assert.equal(await db.collection('storesettings').countDocuments({}), 1)
  await db.collection('storesettings').updateOne({}, { $set: { name: 'Edited by admin' } })
  await runFile(execPath, [contentCli], options)
  assert.equal(await db.collection('cmsblocks').countDocuments({}), 7)
  assert.equal((await db.collection('storesettings').findOne({})).name, 'Edited by admin')
})
