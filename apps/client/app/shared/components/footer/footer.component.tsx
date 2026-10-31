import { StoreContacts } from '@/app/shared/components/store-contacts'
import Link from 'next/link'
import { cacheLife } from 'next/cache'
import type { StoreSettings } from '@/app/shared/api/types/store-settings'
import { Container } from '@/app/shared/components/container'
import { NAVIGATION } from '@/app/shared/constants/navigation'
import styles from './footer.module.css'

export async function Footer({ settings }: { settings: StoreSettings | null }) {
  'use cache'
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 })
  const name = settings?.name || 'Tea store'

  return (
    <footer className={styles.footer}>
      <Container>
        <div className={styles.grid}>
          <div>
            <div className={styles.brand}>{name}</div>
            {settings?.tagline && <p className={styles.description}>{settings.tagline}</p>}
          </div>

          <nav aria-labelledby="footer-explore-title">
            <h2 className={styles.title} id="footer-explore-title">
              Explore
            </h2>
            <ul className={styles.links}>
              {NAVIGATION.links.map(({ id, href, label }) => (
                <li key={id}>
                  <Link href={href}>{label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className={styles.title}>Visit us</h2>
            <address className={styles.address}>
              <StoreContacts settings={settings} compact />
            </address>
          </div>
        </div>

        <div className={styles.copy}>
          <span>
            © {new Date().getFullYear()} {name}
          </span>
        </div>
      </Container>
    </footer>
  )
}
