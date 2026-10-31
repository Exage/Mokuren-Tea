import { StoreContacts } from '@/app/shared/components/store-contacts'
import { getStoreSettings } from '@/app/shared/api/requests/store-settings'
import { getCmsPage } from '@/app/shared/api/requests/cms'
import { cmsText } from '@/app/shared/api/types/cms'
import { Button } from '@mokuren/ui/button'
import { Container } from '@/app/shared/components/container'
import { Eyebrow } from '@/app/shared/components/eyebrow'
import { Title } from '@/app/shared/components/title'
import styles from './contacts.module.css'

export async function ContactsScreen() {
  const [page, settings] = await Promise.all([getCmsPage('contacts'), getStoreSettings()])
  const content = page.blocks['contacts.content']?.content

  const configuredLocation = settings?.location
  const { latitude = 0, longitude = 0 } = configuredLocation || {}
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
              <h2 className={styles.storeTitle}>{settings?.name || 'Tea store'}</h2>
              <address className={styles.details}>
                <StoreContacts settings={settings} />
              </address>

              <div className={styles.actions}>
                {configuredLocation && (
                  <Button href={directionsUrl} target="_blank" rel="noopener noreferrer">
                    Get Directions
                  </Button>
                )}
                <Button href="/catalog" variant="ghost">
                  Browse Teas
                </Button>
              </div>
            </div>

            {configuredLocation && (
              <div>
                <div className={styles.map}>
                  <iframe
                    className={styles.mapFrame}
                    title="OpenStreetMap — store location"
                    src={mapUrl}
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      </Container>
    </main>
  )
}
