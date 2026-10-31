import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, URL } from 'node:url'
import ts from 'typescript'
import { CmsService } from '../../dist/cms/cms.service.js'
import { createAdmin, startTestApp, stopTestApp } from './setup.mjs'

let app
let replSet
let directory
let cms
let origin
let token
let csrfCookie = ''
const originalFetch = globalThis.fetch
const originalDocument = globalThis.document
const originalWindow = globalThis.window

before(async () => {
  const started = await startTestApp('mokuren_admin_cms_client_test')
  ;({ app, replSet } = started)
  ;({ token } = await createAdmin(started.db))
  await app.get(CmsService).initializeFixedBlocks(null)
  await app.listen(0, '127.0.0.1')
  origin = await app.getUrl()
  directory = await mkdtemp(join(tmpdir(), 'mokuren-cms-client-'))
  for (const name of ['admin-auth', 'catalog-request', 'cms']) {
    const source = await readFile(
      new URL(`../../../admin/app/shared/api/requests/${name}.ts`, import.meta.url),
      'utf8'
    )
    const compiled = ts
      .transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
      })
      .outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'")
    await writeFile(join(directory, `${name}.mjs`), compiled)
  }
  cms = await import(pathToFileURL(join(directory, 'cms.mjs')))
  globalThis.document = { cookie: '' }
  globalThis.window = {
    location: { replace: () => assert.fail('Authenticated CMS client unexpectedly redirected') },
  }
  // Node fetch has no browser cookie jar. Adapt only origin and cookies;
  // requests still traverse the real HTTP server, guards, validation and database.
  globalThis.fetch = async (url, options) => {
    const headers = new globalThis.Headers(options?.headers)
    headers.set('Cookie', `admin_session=${token}${csrfCookie ? `; ${csrfCookie}` : ''}`)
    const response = await originalFetch(new URL(url, origin), { ...options, headers })
    const issued = response.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith('csrf_token='))
    if (issued) {
      csrfCookie = issued.split(';')[0]
      globalThis.document.cookie = csrfCookie
    }
    return response
  }
})

after(async () => {
  globalThis.fetch = originalFetch
  globalThis.document = originalDocument
  globalThis.window = originalWindow
  if (app) {
    await stopTestApp(app, replSet)
  }
  if (directory) {
    await rm(directory, { recursive: true, force: true })
  }
})

test('admin CMS client saves, publishes, previews and restores through the real API', async () => {
  const list = await cms.listCmsBlocks()
  assert.equal(list.items.length, 7)
  const initial = list.items.find((block) => block.blockKey === 'home.hero')
  const first = await cms.saveCmsDraft(initial, {
    title: 'The first tea story',
    buttonText: 'Explore',
    buttonUrl: '/catalog',
  })
  assert.equal(first.draftVersion, 1)
  assert.equal(first.published, null)
  await assert.rejects(
    cms.saveCmsDraft(initial, { title: 'Obsolete edit' }),
    (error) => error.code === 'STALE_VERSION'
  )
  await assert.rejects(
    cms.saveCmsDraft(first, { title: 'Unsafe link', buttonUrl: 'javascript:alert(1)' }),
    (error) => error.code === 'VALIDATION_ERROR'
  )
  const published = await cms.publishCmsBlock(first)
  assert.equal(published.publishedVersion, 1)
  assert.equal(published.published.title, first.draft.title)
  const second = await cms.saveCmsDraft(published, { title: 'A new draft' })
  const preview = await cms.previewCmsPage(second)
  assert.equal(preview.blocks['home.hero'].title, 'A new draft')
  assert.equal(preview.blocks['home.visitStore'], null)
  const live = await originalFetch(`${origin}/api/public/cms/pages/home`).then((response) =>
    response.json()
  )
  assert.equal(live.blocks['home.hero'].content.title, 'The first tea story')
  const revisions = await cms.listCmsRevisions(second)
  assert.equal(revisions.items.length, 1)
  const restored = await cms.restoreCmsRevision(second, revisions.items[0].id)
  assert.equal(restored.draft.title, 'The first tea story')
  assert.equal(restored.draftVersion, 3)
  assert.equal(restored.publishedVersion, 1)
})
