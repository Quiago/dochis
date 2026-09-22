'use client'
import type { ElementType } from 'react'
import { Button, type ButtonProps } from '@primer/react'
import { CheckIcon, DownloadIcon, SyncIcon, XIcon } from '@primer/octicons-react'

const ICONS = { check: CheckIcon, download: DownloadIcon, sync: SyncIcon, x: XIcon }
// Primer's polymorphic Button typing can't be forwarded generically; callers stay typed by IconBtnProps.
const PrimerButton = Button as ElementType

type IconBtnProps = Omit<ButtonProps, 'leadingVisual' | 'icon'> & { iconName: keyof typeof ICONS; as?: 'a'; href?: string; download?: boolean }

// Server Components pass the icon by name: an icon element passed as a prop across the server→client boundary
// breaks rendering in production ("Element type is invalid").
export default function IconBtn({ iconName, ...props }: IconBtnProps) {
  return <PrimerButton {...props} leadingVisual={ICONS[iconName]} />
}
