import styles from './store-contacts.module.css'
import type { StoreSettings } from '@/app/shared/api/types/store-settings'

export function StoreContacts({
  settings,
  compact = false,
}: {
  settings: StoreSettings | null
  compact?: boolean
}) {
  const hours = compact ? settings?.hoursShort || settings?.hours : settings?.hours
  const contacts = Object.entries(settings?.contacts || {}).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string' && !!entry[1].trim()
  )
  return (
    <>
      {settings?.address && <div>{settings.address}</div>}
      {hours && <div className={styles.hours}>{hours}</div>}
      {settings?.phone && (
        <div>
          <a href={`tel:${settings.phone.replace(/[^+\d]/g, '')}`}>{settings.phone}</a>
        </div>
      )}
      {contacts.map(([label, value]) => (
        <div key={label}>
          {label.toLowerCase() === 'email' ? (
            <a href={`mailto:${value}`}>{value}</a>
          ) : /^https:\/\//i.test(value) ? (
            <a href={value} target="_blank" rel="noopener noreferrer">
              {label}
            </a>
          ) : (
            <span>
              {label}: {value}
            </span>
          )}
        </div>
      ))}
    </>
  )
}
