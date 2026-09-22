// One colour per kind of data, like GitHub: the same colour on the row labels and on the filter button dot.
// Status keeps its own green/yellow/grey, so these avoid them.
export const CATEGORY = {
  esp: { variant: 'accent', color: 'var(--fgColor-accent)' },
  idioma: { variant: 'done', color: 'var(--fgColor-done)' },
  seguro: { variant: 'sponsors', color: 'var(--fgColor-sponsors)' },
  emirato: { variant: 'severe', color: 'var(--fgColor-severe)' },
} as const

export type Category = keyof typeof CATEGORY
