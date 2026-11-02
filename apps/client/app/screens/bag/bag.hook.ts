import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getBagProducts } from '@/app/shared/api/requests/bag'
import {
  ReservationSubmission,
  ReservationRequestError,
} from '@/app/shared/api/requests/reservations'
import type { ReservationReceipt } from '@/app/shared/api/types/reservations'
import { useBagStore, useBagHydrationHook, type BagItem } from '@/app/shared/stores/bag'
import type { BagLine } from './bag.types'

export function useBagScreenHook() {
  const hasHydrated = useBagHydrationHook()
  const items = useBagStore((state) => state.items)
  const updateQuantity = useBagStore((state) => state.setQuantity)
  const removeItem = useBagStore((state) => state.removeItem)
  const [storageError, setStorageError] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [submissionError, setSubmissionError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [receipt, setReceipt] = useState<ReservationReceipt | null>(null)
  const [submission] = useState(() => new ReservationSubmission())
  const [submittedItems, setSubmittedItems] = useState<BagItem[] | null>(null)
  const successRef = useRef<HTMLHeadingElement>(null)
  const displayedItems = submittedItems || items
  const productIds = [...new Set(displayedItems.map((item) => item.productId))].sort()
  const products = useQuery({
    queryKey: ['bag-products', productIds],
    queryFn: ({ signal }) => getBagProducts(productIds, signal),
    enabled: hasHydrated && productIds.length > 0 && !isSubmitting && !isRetrying && !receipt,
    refetchOnWindowFocus: true,
    staleTime: 0,
    placeholderData: (previous) =>
      productIds.every((id) => previous?.some((product) => product.id === id))
        ? previous
        : undefined,
  })

  useEffect(() => {
    if (receipt) {
      successRef.current?.focus()
    }
  }, [receipt])

  const lines: BagLine[] = displayedItems.map((item) => {
    const product = products.data?.find((entry) => entry.id === item.productId)
    const variant = product?.variants.find((entry) =>
      item.variantId.startsWith('legacy:')
        ? entry.weightGrams === item.weightGrams
        : entry.variantId === item.variantId
    )
    return {
      ...item,
      reservationVariantId: variant?.variantId,
      name: product?.name || 'Unavailable tea',
      slug: product?.slug,
      image: product?.images[0]?.url || '/images/tea-placeholder.svg',
      weightGrams: variant?.weightGrams || item.weightGrams,
      unitPrice: variant?.price || 0,
      available: Boolean(variant?.available),
    }
  })

  const isLocked = isSubmitting || isRetrying
  const hasUnavailableItems = lines.some((line) => !line.available)
  const canSubmit =
    isRetrying ||
    (hasHydrated &&
      lines.length > 0 &&
      lines.length <= 20 &&
      !hasUnavailableItems &&
      !products.isFetching &&
      !products.isError)

  const saveChange = (action: () => void) => {
    if (isLocked) {
      return
    }
    setStorageError('')
    setSubmissionError('')
    try {
      action()
    } catch {
      setStorageError('Your changes could not be saved on this device. Please try again.')
    }
  }

  const setQuantity = (productId: string, variantId: string, quantity: number) => {
    saveChange(() => updateQuantity(productId, variantId, quantity))
  }

  const removeLine = (productId: string, variantId: string) => {
    saveChange(() => removeItem(productId, variantId))
  }

  const submitReservation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submission.isSubmitting || receipt || !canSubmit) {
      return
    }
    const name = customerName.trim()
    const phone = customerPhone.trim()
    const digits = phone.replace(/\D/g, '')
    if (
      !isRetrying &&
      (name.length < 2 ||
        name.length > 200 ||
        !/^[+()\d\s.-]+$/.test(phone) ||
        digits.length < 7 ||
        digits.length > 15)
    ) {
      setSubmissionError('Enter your full name and a phone number with 7–15 digits.')
      return
    }
    const reservedItems = submittedItems || items.map((item) => ({ ...item }))
    setSubmittedItems(reservedItems)
    setIsSubmitting(true)
    setSubmissionError('')
    try {
      const result = await submission.submit({
        source: 'website',
        customerName: name,
        customerPhone: phone,
        lines: lines.map((line) => ({
          productId: line.productId,
          variantId: line.reservationVariantId!,
          quantity: line.quantity,
        })),
      })
      setReceipt(result)
      setCustomerName('')
      setCustomerPhone('')
      // Clear only submitted quantities: another tab may have added more tea meanwhile.
      try {
        useBagStore.getState().removeReservedItems(reservedItems)
      } catch {
        setStorageError(
          'Your request was received, but the saved bag could not be updated on this device. Please avoid submitting it again.'
        )
      }
      setSubmittedItems(null)
      setIsRetrying(false)
    } catch (error) {
      const uncertain = submission.hasUncertainRequest
      setIsRetrying(uncertain)
      if (!uncertain) {
        setSubmittedItems(null)
      }
      setSubmissionError(
        error instanceof ReservationRequestError
          ? error.message
          : 'We could not confirm your request. Please try again to check the same request safely.'
      )
      if (error instanceof ReservationRequestError && error.refreshProducts) {
        void products.refetch()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const itemCount = lines.reduce((total, line) => total + line.quantity, 0)
  const totalPrice =
    lines.reduce(
      (total, line) =>
        total + (line.available ? Math.round(line.unitPrice * 100) * line.quantity : 0),
      0
    ) / 100

  return {
    lines,
    itemCount,
    totalPrice,
    setQuantity,
    removeLine,
    submitReservation,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    submissionError,
    isSubmitting,
    isRetrying,
    isLocked,
    canSubmit,
    hasUnavailableItems,
    receipt,
    successRef,
    isLoading: !hasHydrated || (items.length > 0 && products.isPending),
    hasProductError: !isLocked && items.length > 0 && products.isError,
    storageError,
    retryProducts: () => products.refetch(),
  }
}
