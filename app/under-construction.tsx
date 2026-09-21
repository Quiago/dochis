'use client'
import { Heading, Text } from '@primer/react'
import { ToolsIcon } from '@primer/octicons-react'

export default function UnderConstruction() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: 'var(--base-size-48) var(--base-size-16)', textAlign: 'center' }}>
      <ToolsIcon size={32} />
      <Heading as="h1" style={{ marginTop: 'var(--base-size-16)' }}>En construcción</Heading>
      <Text as="p" style={{ color: 'var(--fgColor-muted)' }}>
        Directorio comunitario y gratuito de médicos que atienden en español en los Emiratos.
      </Text>
    </main>
  )
}
