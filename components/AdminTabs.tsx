'use client'
import { UnderlineNav } from '@primer/react'

export type Tab = { key: string; label: string; count?: number }

export default function AdminTabs({ tabs, current }: { tabs: Tab[]; current: string }) {
  return (
    <UnderlineNav aria-label="Secciones del panel">
      {tabs.map((t) => (
        <UnderlineNav.Item key={t.key} href={`/admin?tab=${t.key}`} aria-current={t.key === current ? 'page' : undefined} counter={t.count}>
          {t.label}
        </UnderlineNav.Item>
      ))}
    </UnderlineNav>
  )
}
