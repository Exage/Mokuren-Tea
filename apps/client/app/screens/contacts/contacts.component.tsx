import { Button } from '@/app/shared/components/button'
import { Container } from '@/app/shared/components/container'
import { Eyebrow } from '@/app/shared/components/eyebrow'
import { Title } from '@/app/shared/components/title'
import styles from './contacts.module.css'

// Keep the demonstration pin and directions destination at the same location.
const DEMO_LOCATION = { latitude: 53.9053, longitude: 27.5619 }
const coordinates = `${DEMO_LOCATION.latitude},${DEMO_LOCATION.longitude}`
const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${DEMO_LOCATION.longitude - 0.012},${DEMO_LOCATION.latitude - 0.006},${DEMO_LOCATION.longitude + 0.012},${DEMO_LOCATION.latitude + 0.006}&layer=mapnik&marker=${coordinates}`
const directionsUrl = `https://www.openstreetmap.org/directions?to=${encodeURIComponent(coordinates)}`

export function ContactsScreen() {
  return (
    <main className={styles.contacts}>
      <Container>
        <section aria-labelledby="contacts-title">
          <Eyebrow className={styles.eyebrow}>Contacts</Eyebrow>
          <Title id="contacts-title" size="2xl">
            Come say hello.
          </Title>

          <div className={styles.content}>
            <div>
              <h2 className={styles.storeTitle}>Mokuren Tea</h2>
              <address className={styles.details}>
                12 Calm Lane, Minsk
                <br />
                Daily 10:00–20:00
                <br />
                <a href="tel:+375291234567">+375 29 123-45-67</a>
                <br />
                <a href="mailto:hello@mokuren-tea.example">hello@mokuren-tea.example</a>
              </address>

              <dl className={styles.hours} aria-label="Opening hours">
                <dt>Mon–Fri</dt>
                <dd>10:00–20:00</dd>
                <dt>Saturday</dt>
                <dd>10:00–18:00</dd>
                <dt>Sunday</dt>
                <dd>11:00–17:00</dd>
              </dl>

              <p className={styles.notice}>
                Reserve online and collect in store — no prepayment. We call to confirm before
                pickup. Demo data for concept purposes.
              </p>

              <div className={styles.actions}>
                <Button href={directionsUrl} target="_blank" rel="noopener noreferrer">
                  Get Directions
                </Button>
                <Button href="/catalog" variant="ghost">
                  Browse Teas
                </Button>
              </div>
            </div>

            <div className={styles.map}>
              <iframe
                className={styles.mapFrame}
                title="OpenStreetMap — demonstration location for Mokuren Tea in Minsk"
                src={mapUrl}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
        </section>
      </Container>
    </main>
  )
}
