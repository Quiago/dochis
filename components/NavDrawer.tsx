'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Dialog, IconButton, NavList } from '@primer/react'
import { BookIcon, HomeIcon, PersonIcon, ShieldCheckIcon, ShieldLockIcon, ThreeBarsIcon } from '@primer/octicons-react'

const ICONS = { home: HomeIcon, about: BookIcon, privacy: ShieldLockIcon, account: PersonIcon, admin: ShieldCheckIcon }
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS }

// GitHub-style side navigation behind the hamburger button.
export default function NavDrawer({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  return (
    <>
      <IconButton icon={ThreeBarsIcon} aria-label="Abrir menú" variant="invisible" onClick={() => setOpen(true)} />
      {open && (
        <Dialog title="Médicos en español" position="left" onClose={() => setOpen(false)} width="small">
          <NavList aria-label="Navegación principal">
            {items.map(({ href, label, icon }) => {
              const Icon = ICONS[icon]
              return (
                <NavList.Item key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>
                  <NavList.LeadingVisual><Icon /></NavList.LeadingVisual>
                  {label}
                </NavList.Item>
              )
            })}
          </NavList>
        </Dialog>
      )}
    </>
  )
}
