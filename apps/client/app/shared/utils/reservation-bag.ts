import { MOCK_PRODUCTS } from '@/app/shared/mocks/products'

export const RESERVATION_WEIGHTS = [50, 100, 200] as const
export const RESERVATION_STORAGE_KEY = 'mokuren-bag'

type ReservationLine = {
  key: string
  id: string
  weight: (typeof RESERVATION_WEIGHTS)[number]
  qty: number
}

export function readReservationBag(): ReservationLine[] {
  const stored: unknown = JSON.parse(window.localStorage.getItem(RESERVATION_STORAGE_KEY) || '[]')

  if (!Array.isArray(stored)) {
    return []
  }

  return stored.filter((line): line is ReservationLine => {
    return (
      line &&
      MOCK_PRODUCTS.some((product) => product.id === line.id) &&
      RESERVATION_WEIGHTS.includes(line.weight) &&
      Number.isInteger(line.qty) &&
      line.qty > 0 &&
      line.qty <= 9
    )
  })
}

export function addToReservation(
  productId: string,
  weight: ReservationLine['weight'],
  quantity: number
): number {
  let bag: ReservationLine[]

  try {
    bag = readReservationBag()
  } catch {
    bag = []
  }

  const line = bag.find((item) => item.id === productId && item.weight === weight)
  const previousQuantity = line?.qty || 0
  const nextQuantity = Math.min(9, previousQuantity + quantity)

  if (line) {
    line.qty = nextQuantity
  } else {
    bag.push({ key: `${productId}_${weight}`, id: productId, weight, qty: nextQuantity })
  }

  window.localStorage.setItem(RESERVATION_STORAGE_KEY, JSON.stringify(bag))
  return nextQuantity - previousQuantity
}
