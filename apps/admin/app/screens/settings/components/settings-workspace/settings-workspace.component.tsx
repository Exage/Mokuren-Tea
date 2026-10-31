'use client'

import clsx from 'clsx'
import { Button } from '@mokuren/ui/button'
import { Input } from '@mokuren/ui/input'
import { Textarea } from '@mokuren/ui/textarea'
import { CatalogFeedback } from '@/app/shared/components/catalog-ui'
import common from '@/app/shared/components/catalog-ui/catalog-ui.module.css'
import { useSettingsWorkspaceHook } from './settings-workspace.hook'
import styles from './settings-workspace.module.css'

export function SettingsWorkspace() {
  const state = useSettingsWorkspaceHook()
  const { form, saved, loading, busy, dirty } = state
  const structuredContacts = Object.entries(saved?.contacts || {}).filter(
    ([, value]) => typeof value !== 'string'
  )

  return (
    <div className={common.stack} aria-busy={loading || busy}>
      <div className={styles.toolbar}>
        <p className={common.muted}>
          {dirty ? 'You have unsaved changes.' : 'General information about your store.'}
        </p>
        <Button type="button" variant="ghost" disabled={loading || busy} onClick={state.refresh}>
          Reload settings
        </Button>
      </div>
      <CatalogFeedback error={state.error} notice={state.notice} loading={loading} />
      {!loading && !saved && !state.error && (
        <section className={clsx(common.panel, common.stack)}>
          <h2>Store settings are not available yet</h2>
          <p>Initial store setup must be completed before settings can be edited.</p>
        </section>
      )}
      {!loading && form && saved && (
        <form className={common.stack} onSubmit={state.save}>
          <fieldset className={common.fields} disabled={busy}>
            <div className={styles.columns}>
              <section
                className={clsx(common.panel, common.stack)}
                aria-labelledby="store-details-title"
              >
                <div className={styles.sectionHeading}>
                  <h2 id="store-details-title">Store details</h2>
                  <p className={common.muted}>The name and short introduction to your store.</p>
                </div>
                <label className={common.field}>
                  Store name
                  <Input
                    required
                    maxLength={200}
                    value={form.name}
                    onChange={(event) => state.update({ name: event.target.value })}
                    autoComplete="organization"
                  />
                </label>
                <label className={common.field}>
                  Tagline
                  <Textarea
                    maxLength={500}
                    rows={3}
                    value={form.tagline}
                    onChange={(event) => state.update({ tagline: event.target.value })}
                  />
                </label>
              </section>
              <section
                className={clsx(common.panel, common.stack)}
                aria-labelledby="store-visit-title"
              >
                <div className={styles.sectionHeading}>
                  <h2 id="store-visit-title">Visit & pickup</h2>
                  <p className={common.muted}>Help customers plan their visit.</p>
                </div>
                <label className={common.field}>
                  Address
                  <Textarea
                    maxLength={500}
                    rows={3}
                    value={form.address}
                    onChange={(event) => state.update({ address: event.target.value })}
                    autoComplete="street-address"
                  />
                </label>
                <label className={common.field}>
                  Opening hours — full
                  <Textarea
                    maxLength={500}
                    rows={3}
                    value={form.hours || ''}
                    onChange={(event) => state.update({ hours: event.target.value })}
                    placeholder={
                      'Monday–Friday: 10:00–20:00\nSaturday: 10:00–18:00\nSunday: 11:00–17:00'
                    }
                  />
                </label>
                <p className={common.muted}>
                  Shown on the Contacts page. Use a separate line for each day or group of days.
                </p>
                <label className={common.field}>
                  Opening hours — compact
                  <Input
                    maxLength={200}
                    value={form.hoursShort || ''}
                    onChange={(event) => state.update({ hoursShort: event.target.value })}
                    placeholder="e.g. Mon–Sun, from 10:00"
                  />
                </label>
                <p className={common.muted}>
                  Shown in the footer and the home visit section. If empty, the full opening hours
                  are used.
                </p>
              </section>
            </div>
            <section className={clsx(common.panel, common.stack)} aria-labelledby="store-map-title">
              <h2 id="store-map-title">Map location</h2>
              <p className={common.muted}>
                Enter both coordinates for the store address. Clear both to hide the map.
              </p>
              {(['latitude', 'longitude'] as const).map((key) => (
                <label className={common.field} key={key}>
                  {key === 'latitude' ? 'Latitude' : 'Longitude'}
                  <Input
                    type="number"
                    step="any"
                    min={key === 'latitude' ? -85.0511 : -180}
                    max={key === 'latitude' ? 85.0511 : 180}
                    value={form[key]}
                    required={!!form[key === 'latitude' ? 'longitude' : 'latitude']}
                    onChange={(event) => state.update({ [key]: event.target.value })}
                  />
                </label>
              ))}
            </section>
            <section
              className={clsx(common.panel, common.stack)}
              aria-labelledby="store-contacts-title"
            >
              <div className={styles.sectionHeading}>
                <h2 id="store-contacts-title">Contact details</h2>
                <p className={common.muted}>Add the ways customers can reach your store.</p>
              </div>
              <label className={clsx(common.field, styles.phone)}>
                Phone number
                <Input
                  type="tel"
                  autoComplete="tel"
                  maxLength={100}
                  value={form.phone}
                  onChange={(event) => state.update({ phone: event.target.value })}
                />
              </label>
              {form.contacts.map((contact, index) => (
                <div className={styles.contact} key={contact.id}>
                  <label className={common.field}>
                    Contact label
                    <Input
                      aria-label={`Contact ${index + 1} label`}
                      value={contact.key}
                      placeholder="e.g. email or Instagram"
                      onChange={(event) =>
                        state.update({
                          contacts: form.contacts.map((row) =>
                            row.id === contact.id ? { ...row, key: event.target.value } : row
                          ),
                        })
                      }
                    />
                  </label>
                  <label className={common.field}>
                    Contact value
                    <Input
                      aria-label={`Contact ${index + 1} value`}
                      value={contact.value}
                      placeholder="Email address, profile link, or contact details"
                      onChange={(event) =>
                        state.update({
                          contacts: form.contacts.map((row) =>
                            row.id === contact.id ? { ...row, value: event.target.value } : row
                          ),
                        })
                      }
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`Remove contact ${index + 1}`}
                    onClick={() =>
                      state.update({
                        contacts: form.contacts.filter((row) => row.id !== contact.id),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {structuredContacts.length > 0 && (
                <p className={common.muted}>
                  Additional contact information is preserved:{' '}
                  {structuredContacts.map(([key]) => key).join(', ')}.
                </p>
              )}
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    state.update({
                      contacts: [...form.contacts, { id: crypto.randomUUID(), key: '', value: '' }],
                    })
                  }
                >
                  Add contact
                </Button>
              </div>
            </section>
          </fieldset>
          <div className={styles.footer}>
            <p className={common.muted}>
              Saved changes appear throughout the website after its cache refreshes (normally within
              five minutes). Last updated: {new Date(saved.updatedAt).toLocaleString('en-GB')}.
            </p>
            <div className={common.actions}>
              <Button
                type="button"
                variant="ghost"
                disabled={busy || !dirty}
                onClick={state.discard}
              >
                Discard changes
              </Button>
              <Button type="submit" disabled={busy || !dirty}>
                {busy ? 'Saving…' : 'Save settings'}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
