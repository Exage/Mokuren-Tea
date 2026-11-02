import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { BAG_STORAGE_KEY, useBagStore } from '../app/shared/stores/bag/bag.store.ts'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
let saved
const item = {
  productId: '64f000000000000000000001',
  variantId: 'v_sencha_50',
  weightGrams: 50,
  quantity: 2,
}

beforeEach(() => {
  saved = new Map()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key) => saved.get(key) || null,
        setItem: (key, value) => saved.set(key, value),
        removeItem: (key) => saved.delete(key),
      },
    },
  })
  useBagStore.setState({ items: [] })
  saved.clear()
})

afterEach(() => {
  if (originalWindow) {
    Object.defineProperty(globalThis, 'window', originalWindow)
  } else {
    delete globalThis.window
  }
})

test('real product selections survive a localStorage round trip without persisting actions', async () => {
  assert.equal(useBagStore.getState().addItem(item), 2)
  const persisted = saved.get(BAG_STORAGE_KEY)
  assert.deepEqual(JSON.parse(persisted), { state: { items: [item] }, version: 1 })

  useBagStore.setState({ items: [] })
  saved.set(BAG_STORAGE_KEY, persisted)
  await useBagStore.persist.rehydrate()
  assert.deepEqual(useBagStore.getState().items, [item])
  assert.equal(typeof useBagStore.getState().addItem, 'function')
})

test('repeated additions merge the same size, cap quantity, and keep other sizes separate', () => {
  useBagStore.getState().addItem(item)
  assert.equal(useBagStore.getState().addItem({ ...item, quantity: 8 }), 7)
  assert.equal(useBagStore.getState().addItem(item), 0)
  useBagStore.getState().addItem({ ...item, variantId: 'v_sencha_100', weightGrams: 100 })
  assert.deepEqual(
    useBagStore.getState().items.map((line) => line.quantity),
    [9, 2]
  )
})

test('quantity changes and removals are persisted for the selected size only', () => {
  useBagStore.getState().addItem(item)
  useBagStore.getState().addItem({ ...item, variantId: 'v_sencha_100', weightGrams: 100 })
  useBagStore.getState().setQuantity(item.productId, item.variantId, 4)
  useBagStore.getState().removeItem(item.productId, 'v_sencha_100')
  assert.deepEqual(JSON.parse(saved.get(BAG_STORAGE_KEY)).state.items, [{ ...item, quantity: 4 }])
  useBagStore.getState().clearBag()
  assert.deepEqual(JSON.parse(saved.get(BAG_STORAGE_KEY)).state.items, [])
})

test('the legacy bag is restored by weight and merges with a real variant on the next addition', async () => {
  saved.set(
    BAG_STORAGE_KEY,
    JSON.stringify([
      { id: item.productId, weight: 50, qty: 3 },
      { id: item.productId, weight: 50, qty: 1 },
    ])
  )
  await useBagStore.persist.rehydrate()
  assert.deepEqual(useBagStore.getState().items, [{ ...item, variantId: 'legacy:50', quantity: 4 }])
  useBagStore.getState().addItem(item)
  assert.deepEqual(useBagStore.getState().items, [{ ...item, quantity: 6 }])
})

test('invalid saved lines cannot corrupt the store or replace its actions', async () => {
  saved.set(
    BAG_STORAGE_KEY,
    JSON.stringify({
      state: {
        addItem: 'invalid',
        items: [null, { ...item, productId: 'invalid' }, { ...item, quantity: -1 }, item],
      },
      version: 1,
    })
  )
  await useBagStore.persist.rehydrate()
  assert.deepEqual(useBagStore.getState().items, [item])
  assert.equal(typeof useBagStore.getState().addItem, 'function')
})

test('malformed JSON and inaccessible storage finish hydration without crashing', async () => {
  saved.set(BAG_STORAGE_KEY, '{broken')
  await useBagStore.persist.rehydrate()
  assert.deepEqual(useBagStore.getState().items, [])
  window.localStorage.getItem = () => {
    throw new Error('Storage blocked')
  }
  await useBagStore.persist.rehydrate()
  assert.equal(useBagStore.persist.hasHydrated(), true)
})

test('new lines stop at the reservation limit while existing lines can still be changed', () => {
  for (let index = 0; index < 20; index++) {
    useBagStore.getState().addItem({ ...item, variantId: `v_${index}` })
  }
  assert.equal(useBagStore.getState().addItem(item), 'line-limit')
  assert.equal(useBagStore.getState().items.length, 20)
  assert.equal(useBagStore.getState().addItem({ ...item, variantId: 'v_0' }), 2)
})

test('failed persistence is reported to the caller instead of claiming a saved bag', () => {
  window.localStorage.setItem = () => {
    throw new Error('Storage full')
  }
  assert.throws(() => useBagStore.getState().addItem(item), /Storage full/)
})

test('successful reservations clear submitted quantities and preserve additions from another tab', () => {
  const other = { ...item, variantId: 'v_sencha_100', weightGrams: 100 }
  useBagStore.getState().addItem(item)
  const submitted = useBagStore.getState().items.map((line) => ({ ...line }))
  useBagStore.getState().addItem(item)
  useBagStore.getState().addItem(other)
  useBagStore.getState().removeReservedItems(submitted)
  assert.deepEqual(useBagStore.getState().items, [item, other])
  assert.deepEqual(JSON.parse(saved.get(BAG_STORAGE_KEY)).state.items, [item, other])
  useBagStore.getState().removeReservedItems([item])
  assert.deepEqual(useBagStore.getState().items, [other])
})

test('reservation cleanup handles a legacy line upgraded by an addition in another tab', async () => {
  saved.set(
    BAG_STORAGE_KEY,
    JSON.stringify([{ id: item.productId, weight: item.weightGrams, qty: item.quantity }])
  )
  await useBagStore.persist.rehydrate()
  const submitted = useBagStore.getState().items.map((line) => ({ ...line }))

  useBagStore.getState().addItem(item)
  useBagStore.getState().removeReservedItems(submitted)

  assert.deepEqual(useBagStore.getState().items, [item])
  assert.deepEqual(JSON.parse(saved.get(BAG_STORAGE_KEY)).state.items, [item])
})
