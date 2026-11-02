import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Product } from '@/app/shared/api/types/catalog'
import type { Reservation, ReservationLine } from '@/app/shared/api/types/reservations'
import { createReservation, updateReservation } from '@/app/shared/api/requests/reservations'
import { listProducts } from '@/app/shared/api/requests/products'
import { useCatalogListHook, useCatalogMutationHook } from '@/app/shared/hooks/catalog-data.hook'

export function useReservationEditorHook(
  reservation: Reservation | null,
  onSaved: (value: Reservation) => void
) {
  const [lines, setLines] = useState<ReservationLine[]>(reservation?.lines || [])
  const products = useCatalogListHook(listProducts, 'published')
  const mutation = useCatalogMutationHook()
  function add(product: Product, variantId: string) {
    const variant = product.variants.find((item) => item.variantId === variantId)
    if (!variant) {
      return
    }
    setLines((current) => {
      const existing = current.find(
        (line) => line.productId === product.id && line.variantId === variantId
      )
      if (existing) {
        return current.map((line) =>
          line === existing ? { ...line, quantity: Math.min(1000, line.quantity + 1) } : line
        )
      }
      return [
        ...current,
        {
          productId: product.id,
          variantId,
          quantity: 1,
          productName: product.name,
          variantWeightGrams: variant.weightGrams,
          variantPrice: variant.price,
          lineTotal: variant.price,
          grams: variant.weightGrams,
        },
      ]
    })
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const input = {
      customerName: String(form.get('customerName') || '').trim(),
      customerPhone: String(form.get('customerPhone') || '').trim(),
      lines: lines.map(({ productId, variantId, quantity }) => ({
        productId,
        variantId,
        quantity,
      })),
    }
    void mutation.run(async () => {
      const originalLines = reservation?.lines.map(({ productId, variantId, quantity }) => ({
        productId,
        variantId,
        quantity,
      }))
      const result = reservation
        ? await updateReservation(reservation.id, {
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            ...(JSON.stringify(originalLines) !== JSON.stringify(input.lines)
              ? { lines: input.lines }
              : {}),
          })
        : await createReservation(input)
      onSaved(result)
    }, 'Reservation saved.')
  }
  return { lines, setLines, products, mutation, add, save }
}
