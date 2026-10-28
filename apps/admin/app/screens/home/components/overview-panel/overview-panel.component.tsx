import type { ReactNode } from 'react'
import styles from './overview-panel.module.css'

type OverviewPanelProps = {
  title: string
  action: ReactNode
  children: ReactNode
}

export function OverviewPanel({ title, action, children }: OverviewPanelProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
