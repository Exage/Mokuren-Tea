import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

let directory
let formApi
let requests

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'mokuren-settings-test-'))
  const files = {
    'settings-form': '../app/screens/settings/components/settings-workspace/settings-form.ts',
    'store-settings': '../app/shared/api/requests/store-settings.ts',
    'catalog-request': '../app/shared/api/requests/catalog-request.ts',
    'admin-auth': '../app/shared/api/requests/admin-auth.ts',
  }
  for (const [name, file] of Object.entries(files)) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8')
    const compiled = ts
      .transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
      })
      .outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'")
    await writeFile(join(directory, `${name}.mjs`), compiled)
  }
  formApi = await import(pathToFileURL(join(directory, 'settings-form.mjs')))
  requests = await import(pathToFileURL(join(directory, 'store-settings.mjs')))
})

after(async () => rm(directory, { recursive: true, force: true }))

const saved = {
  id: 'settings',
  name: 'Mokuren Tea',
  tagline: 'A moment of calm',
  address: null,
  hours: null,
  phone: '+375291234567',
  contacts: { email: 'tea@example.com', location: { city: 'Minsk' } },
  updatedAt: '2026-10-29T10:00:00.000Z',
}

test('unchanged settings do not produce a mutation', () => {
  assert.deepEqual(formApi.settingsPatch(formApi.settingsForm(saved), saved), {})
})

test('trims edited values, clears optional fields with null, and patches only changes', () => {
  const form = {
    ...formApi.settingsForm(saved),
    name: ' New store ',
    phone: '   ',
    address: ' Main street ',
  }
  assert.deepEqual(formApi.settingsPatch(form, saved), {
    name: 'New store',
    phone: null,
    address: 'Main street',
  })
  assert.throws(() => formApi.settingsPatch({ ...form, name: ' ' }, saved), /store name/)
})

test('contact edits preserve structured entries and support explicit removal', () => {
  const form = formApi.settingsForm(saved)
  form.contacts = [{ id: 'new', key: ' Instagram ', value: ' https://example.com/tea ' }]
  assert.deepEqual(formApi.settingsPatch(form, saved), {
    contacts: { location: { city: 'Minsk' }, Instagram: 'https://example.com/tea' },
  })
  assert.deepEqual(
    formApi.settingsPatch(
      { ...form, contacts: [] },
      { ...saved, contacts: { email: 'tea@example.com' } }
    ),
    { contacts: null }
  )
})

test('rejects incomplete and duplicate contacts, including collisions with structured entries', () => {
  const form = formApi.settingsForm(saved)
  for (const contacts of [
    [{ id: '1', key: 'email', value: '' }],
    [
      { id: '1', key: ' email ', value: 'a' },
      { id: '2', key: 'email', value: 'b' },
    ],
    [{ id: '1', key: 'location', value: 'overwrite' }],
  ]) {
    assert.throws(() => formApi.settingsPatch({ ...form, contacts }, saved))
  }
  assert.deepEqual(
    formApi.settingsPatch(
      { ...form, contacts: [...form.contacts, { id: 'blank', key: '', value: '' }] },
      saved
    ),
    {}
  )
})

test('requests load absent settings and send a partial authenticated PATCH without retrying network failures', async () => {
  const originalFetch = globalThis.fetch
  const originalDocument = globalThis.document
  const originalCookieName = process.env.NEXT_PUBLIC_CSRF_TOKEN_NAME
  const calls = []
  try {
    process.env.NEXT_PUBLIC_CSRF_TOKEN_NAME = 'csrf_token'
    globalThis.document = { cookie: 'csrf_token=settings-token' }
    globalThis.fetch = async (url, options) => {
      calls.push({ url, ...options })
      return new Response(JSON.stringify(options.method ? saved : null))
    }
    const controller = new AbortController()
    assert.equal(await requests.getStoreSettings(controller.signal), null)
    controller.abort()
    assert.equal(calls[0].signal.aborted, true)
    assert.deepEqual(await requests.updateStoreSettings({ phone: null }), saved)
    assert.equal(calls[1].url, '/api/admin/store-settings')
    assert.equal(calls[1].method, 'PATCH')
    assert.equal(calls[1].credentials, 'include')
    assert.equal(calls[1].headers.get('X-CSRF-Token'), 'settings-token')
    assert.deepEqual(JSON.parse(calls[1].body), { phone: null })
    globalThis.fetch = async () => {
      calls.push('failed')
      throw new TypeError('Connection lost')
    }
    await assert.rejects(requests.updateStoreSettings({ name: 'New name' }))
    assert.equal(calls.length, 3)
  } finally {
    globalThis.fetch = originalFetch
    globalThis.document = originalDocument
    if (originalCookieName === undefined) {
      delete process.env.NEXT_PUBLIC_CSRF_TOKEN_NAME
    } else {
      process.env.NEXT_PUBLIC_CSRF_TOKEN_NAME = originalCookieName
    }
  }
})

test('map coordinates support zero, clearing, partial input errors and bounds', () => {
  const form = formApi.settingsForm(saved)
  assert.deepEqual(formApi.settingsPatch({ ...form, latitude: '0', longitude: '0' }, saved), {
    location: { latitude: 0, longitude: 0 },
  })
  const located = { ...saved, location: { latitude: 0, longitude: 0 } }
  assert.deepEqual(formApi.settingsPatch(formApi.settingsForm(located), located), {})
  assert.deepEqual(formApi.settingsPatch(form, located), { location: null })
  for (const location of [
    { latitude: '0', longitude: '' },
    { latitude: '', longitude: '0' },
    { latitude: '86', longitude: '0' },
    { latitude: '0', longitude: '181' },
    { latitude: 'invalid', longitude: '0' },
  ]) {
    assert.throws(() => formApi.settingsPatch({ ...form, ...location }, saved))
  }
})

test('full and compact opening hours are saved independently and compact hours can be cleared', () => {
  const settings = {
    ...saved,
    hours: 'Monday–Friday: 10:00–20:00\nSaturday: 10:00–18:00',
    hoursShort: 'Mon–Sat, from 10:00',
  }
  const form = formApi.settingsForm(settings)
  assert.deepEqual(formApi.settingsPatch(form, settings), {})
  assert.deepEqual(formApi.settingsPatch({ ...form, hoursShort: '  Mon–Sat 10:00  ' }, settings), {
    hoursShort: 'Mon–Sat 10:00',
  })
  assert.deepEqual(formApi.settingsPatch({ ...form, hoursShort: '' }, settings), {
    hoursShort: null,
  })
  assert.deepEqual(formApi.settingsPatch({ ...form, hours: 'New full schedule' }, settings), {
    hours: 'New full schedule',
  })
})

test('a form retained from before the compact hours field was added preserves its saved value', () => {
  const settings = { ...saved, hours: 'Weekdays', hoursShort: 'Mon–Fri' }
  const form = formApi.settingsForm(settings)
  delete form.hoursShort
  assert.deepEqual(formApi.settingsPatch(form, settings), {})
  assert.deepEqual(formApi.settingsPatch({ ...form, hours: 'New full hours' }, settings), {
    hours: 'New full hours',
  })
})
