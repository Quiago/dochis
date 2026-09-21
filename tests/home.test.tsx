// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import Providers from '@/app/providers'
import UnderConstruction from '@/app/under-construction'

describe('home fase 0', () => {
  it('muestra "En construcción" con Primer', () => {
    render(<Providers><UnderConstruction /></Providers>)
    expect(screen.getByRole('heading', { name: /en construcción/i })).toBeTruthy()
  })

  it('layout en español con tema claro/oscuro automático y sin marca de GitHub', () => {
    const layout = readFileSync('app/layout.tsx', 'utf8')
    expect(layout).toMatch(/lang="es"/)
    expect(layout).toMatch(/data-color-mode="auto"/)
    expect(layout).toMatch(/data-dark-theme="dark"/)
    expect(layout.toLowerCase()).not.toMatch(/github/)
  })
})
