import { Suspense } from 'react'
import { connection } from 'next/server'
import { getCmsPage } from '@/app/shared/api/requests/cms'
import { cmsText } from '@/app/shared/api/types/cms'
import { Button } from '@mokuren/ui/button'
import { Container } from '@/app/shared/components/container'
import { Eyebrow } from '@/app/shared/components/eyebrow'
import { Title } from '@/app/shared/components/title'
import styles from './contacts.module.css'

const DEMO_LOCATION = { latitude: 53.9053, longitude: 27.5619 }

function getLocation(value: unknown): { latitude: number; longitude: number } | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const { latitude, longitude } = value as Record<string, unknown>
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 85.0511 ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180
  ) {
    return null
  }
  return { latitude, longitude }
}

export function ContactsScreen() {
  return (
    <Suspense fallback={null}>
      <ContactsContent />
    </Suspense>
  )
}

async function ContactsContent() {
  await connection()
  const page = await getCmsPage('contacts')
  const content = page.blocks['contacts.content']?.content
  const address = cmsText(content, 'address') || '12 Calm Lane, Minsk'
  const hours = cmsText(content, 'hours') || 'Daily 10:00–20:00'
  const phone = cmsText(content, 'phone') || '+375 29 123-45-67'
  const email = cmsText(content, 'email') || 'hello@mokuren-tea.example'
  const configuredLocation = getLocation(content?.location)
  const { latitude, longitude } = configuredLocation || DEMO_LOCATION
  const coordinates = `${latitude},${longitude}`
  const bounds = [
    Math.max(-180, longitude - 0.012),
    Math.max(-85.0511, latitude - 0.006),
    Math.min(180, longitude + 0.012),
    Math.min(85.0511, latitude + 0.006),
  ]
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bounds.join(',')}&layer=mapnik&marker=${coordinates}`
  const directionsUrl = `https://www.openstreetmap.org/directions?to=${encodeURIComponent(coordinates)}`

  return (
    <main className={styles.contacts}>
      <Container>
        <section aria-labelledby="contacts-title">
          <Eyebrow className={styles.eyebrow}>Contacts</Eyebrow>
          <Title id="contacts-title" size="2xl">
            {cmsText(content, 'title') || 'Come say hello.'}
          </Title>

          <div className={styles.content}>
            <div>
              <h2 className={styles.storeTitle}>Mokuren Tea</h2>
              <address className={styles.details}>
                {address}
                <br />
                {hours}
                <br />
                <a href={`tel:${phone.replace(/[^+\d]/g, '')}`}>{phone}</a>
                <br />
                <a href={`mailto:${email}`}>{email}</a>
              </address>

              {!content && (
                <dl className={styles.hours} aria-label="Opening hours">
                  <dt>Mon–Fri</dt>
                  <dd>10:00–20:00</dd>
                  <dt>Saturday</dt>
                  <dd>10:00–18:00</dd>
                  <dt>Sunday</dt>
                  <dd>11:00–17:00</dd>
                </dl>
              )}

              {!content && (
                <p className={styles.notice}>
                  Reserve online and collect in store — no prepayment. We call to confirm before
                  pickup. Demo data for concept purposes.
                </p>
              )}

              <div className={styles.actions}>
                <Button href={directionsUrl} target="_blank" rel="noopener noreferrer">
                  {configuredLocation ? 'Get Directions' : 'View Example Directions'}
                </Button>
                <Button href="/catalog" variant="ghost">
                  Browse Teas
                </Button>
              </div>
            </div>

            <div>
              <div className={styles.map}>
                <iframe
                  className={styles.mapFrame}
                  title={
                    configuredLocation
                      ? 'OpenStreetMap — store location'
                      : 'OpenStreetMap — example location'
                  }
                  src={mapUrl}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
              {!configuredLocation && (
                <p className={styles.mapNote}>
                  This is an example location. The store location has not been set yet.
                </p>
              )}
            </div>
          </div>
        </section>
      </Container>
    </main>
  )
}
