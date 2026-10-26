import Link from 'next/link'
import { Container } from '@/app/shared/components/container'
import { NAVIGATION } from '@/app/shared/constants/navigation'
import styles from './footer.module.css'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <Container>
        <div className={styles.grid}>
          <div>
            <div className={styles.brand}>Mokuren Tea</div>
            <p className={styles.description}>
              Thoughtfully chosen teas for quiet moments. Find your moment of calm.
            </p>
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
              12 Calm Lane, Minsk
              <br />
              Daily 10:00–20:00
              <br />
              +375 29 123-45-67
              <br />
              hello@mokuren-tea.example
            </address>
          </div>
        </div>

        <div className={styles.copy}>
          <span>
            © 2026 Mokuren Tea — design concept prototype. Fictional data for demonstration.
          </span>
          <span>Instagram · Pinterest</span>
        </div>
      </Container>
    </footer>
  )
}
