'use client'
import { ActionList, ActionMenu } from '@primer/react'

export type Menu = { label: string; color?: string; items: { text: string; href: string; active: boolean }[] }

// Client-only because Primer compound components (ActionMenu.Button…) can't be dotted into from RSC.
export default function FilterMenus({ menus }: { menus: Menu[] }) {
  return menus.map((m) => (
    <ActionMenu key={m.label}>
      <ActionMenu.Button size="small" leadingVisual={m.color ? () => <span className="dot" style={{ background: m.color }} /> : undefined}>{m.label}</ActionMenu.Button>
      <ActionMenu.Overlay>
        <ActionList>
          {m.items.map((it, i) => [
            <ActionList.LinkItem key={it.href} href={it.href} active={it.active}>{it.text}</ActionList.LinkItem>,
            i === 0 && <ActionList.Divider key="divider" />,
          ])}
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  ))
}
