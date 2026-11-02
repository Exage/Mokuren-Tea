import type { FormEventHandler } from 'react'
import { Button } from '@mokuren/ui/button'
import { Input } from '@mokuren/ui/input'
import styles from './bag-summary.module.css'

type BagSummaryProps = {
  itemCount: number
  totalPrice: number
  onSubmit: FormEventHandler<HTMLFormElement>
  customerName: string
  onNameChange: (value: string) => void
  customerPhone: string
  onPhoneChange: (value: string) => void
  isSubmitting: boolean
  isRetrying: boolean
  canSubmit: boolean
  hasUnavailableItems: boolean
  error: string
}

export function BagSummary({
  itemCount,
  totalPrice,
  onSubmit,
  customerName,
  onNameChange,
  customerPhone,
  onPhoneChange,
  isSubmitting,
  isRetrying,
  canSubmit,
  hasUnavailableItems,
  error,
}: BagSummaryProps) {
  return (
    <section className={styles.summary} aria-labelledby="bag-summary-title">
      <h2 className={styles.title} id="bag-summary-title">
        Reserve for pickup
      </h2>
      <p className={styles.count} aria-live="polite" aria-atomic="true">
        {itemCount} {itemCount === 1 ? 'item' : 'items'} · Estimated total{' '}
        <strong>{totalPrice.toFixed(2)} BYN</strong>
      </p>
      <p className={styles.notice}>
        Your reservation request will be reviewed by our team. We’ll contact you to confirm
        availability and arrange pickup.
      </p>
      <form
        className={styles.form}
        onSubmit={onSubmit}
        aria-labelledby="bag-summary-title"
        aria-busy={isSubmitting}
      >
        <fieldset className={styles.fields} disabled={isSubmitting || isRetrying}>
          <div className={styles.field}>
            <label htmlFor="bag-customer-name">Full name</label>
            <Input
              className={styles.input}
              id="bag-customer-name"
              name="customerName"
              type="text"
              autoComplete="name"
              placeholder="e.g. Anna Ivanova"
              minLength={2}
              maxLength={200}
              value={customerName}
              onChange={(event) => onNameChange(event.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="bag-customer-phone">Phone number</label>
            <Input
              className={styles.input}
              id="bag-customer-phone"
              name="customerPhone"
              type="tel"
              autoComplete="tel"
              placeholder="+375 …"
              maxLength={50}
              required
              value={customerPhone}
              onChange={(event) => onPhoneChange(event.target.value)}
              aria-describedby="bag-phone-hint"
            />
            <p className={styles.hint} id="bag-phone-hint">
              Include your country code, for example +375 29 123 45 67.
            </p>
          </div>
        </fieldset>
        <div aria-live="polite" aria-atomic="true">
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {!isRetrying && hasUnavailableItems && (
            <p className={styles.error}>
              Remove unavailable teas or sizes before sending your request.
            </p>
          )}
        </div>
        <Button
          className={styles.submit}
          type="submit"
          disabled={isSubmitting || !canSubmit}
          aria-describedby="bag-reservation-note"
        >
          {isSubmitting
            ? 'Sending request…'
            : isRetrying
              ? 'Retry reservation request'
              : 'Request Reservation'}
        </Button>
        <p className={styles.availability} id="bag-reservation-note">
          No online payment. Your reservation is confirmed after we contact you.
        </p>
      </form>
    </section>
  )
}
