'use client'

import Link from 'next/link'
import { Button } from '@mokuren/ui/button'
import { Container } from '@/app/shared/components/container'
import { Description } from '@/app/shared/components/description'
import { Eyebrow } from '@/app/shared/components/eyebrow'
import { Title } from '@/app/shared/components/title'
import { QueryProvider } from '@/app/shared/components/query-provider'
import { BagItem } from './components/bag-item'
import { BagSummary } from './components/bag-summary'
import { useBagScreenHook } from './bag.hook'
import styles from './bag.module.css'

export function BagScreen() {
  return (
    <QueryProvider>
      <BagContent />
    </QueryProvider>
  )
}

function BagContent() {
  const {
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
    isLoading,
    hasProductError,
    storageError,
    retryProducts,
  } = useBagScreenHook()

  return (
    <main className={styles.bag}>
      <Container>
        {storageError && (
          <p className={styles.error} role="alert">
            {storageError}
          </p>
        )}
        {receipt ? (
          <section className={styles.success} aria-labelledby="bag-success-title">
            <Eyebrow className={styles.eyebrow}>Request received</Eyebrow>
            <Title id="bag-success-title" size="2xl" ref={successRef} tabIndex={-1}>
              Your next cup is on its way.
            </Title>
            <p className={styles.reference}>Reservation {receipt.number}</p>
            <Description className={styles.emptyDescription}>
              Thank you. We’ll call you to confirm availability and arrange in-store pickup. Please
              wait for confirmation before visiting. No payment is due now.
            </Description>
            <p className={styles.receiptTotal}>
              Request total: <strong>{receipt.totalAmount.toFixed(2)} BYN</strong>
            </p>
            <div className={styles.successActions}>
              <Button href="/catalog">Explore more teas</Button>
              <Button href="/contacts" variant="ghost">
                Store details
              </Button>
            </div>
          </section>
        ) : isLoading && !isLocked ? (
          <section className={styles.empty} role="status" aria-live="polite">
            <Title size="2xl">Your bag</Title>
            <Description className={styles.emptyDescription}>Loading your teas…</Description>
          </section>
        ) : hasProductError ? (
          <section className={styles.empty} role="alert">
            <Title size="2xl">Could not load your teas.</Title>
            <Description className={styles.emptyDescription}>
              Your saved bag is still here. Please try again to check prices and availability.
            </Description>
            <Button type="button" onClick={retryProducts}>
              Try again
            </Button>
          </section>
        ) : lines.length || isLocked ? (
          <section aria-labelledby="bag-title">
            <Eyebrow className={styles.eyebrow}>Reservation</Eyebrow>
            <Title id="bag-title" size="2xl">
              Your bag
            </Title>
            <Description className={styles.description}>
              No online payment — we confirm by phone before pickup.
            </Description>

            <div className={styles.layout}>
              <div className={styles.items}>
                <ul className={styles.list} aria-label="Teas in your reservation bag">
                  {lines.map((line) => (
                    <BagItem
                      key={`${line.productId}:${line.variantId}`}
                      line={line}
                      disabled={isLocked}
                      onQuantityChange={setQuantity}
                      onRemove={removeLine}
                    />
                  ))}
                </ul>
                <Link className={styles.back} href="/catalog">
                  <span aria-hidden="true">←</span> Continue browsing
                </Link>
              </div>

              <BagSummary
                itemCount={itemCount}
                totalPrice={totalPrice}
                onSubmit={submitReservation}
                customerName={customerName}
                onNameChange={setCustomerName}
                customerPhone={customerPhone}
                onPhoneChange={setCustomerPhone}
                isSubmitting={isSubmitting}
                isRetrying={isRetrying}
                canSubmit={canSubmit}
                hasUnavailableItems={hasUnavailableItems}
                error={submissionError}
              />
            </div>
          </section>
        ) : (
          <section className={styles.empty} aria-labelledby="bag-empty-title">
            <Title id="bag-empty-title" size="2xl">
              Your bag is empty.
            </Title>
            <Description className={styles.emptyDescription}>
              Browse the catalog and reserve a few teas for in-store pickup.
            </Description>
            <Button href="/catalog">Browse Teas</Button>
          </section>
        )}
      </Container>
    </main>
  )
}
