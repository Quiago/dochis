'use client'
import { useState } from 'react'
import { Button, Dialog, Flash, FormControl, Link, Select } from '@primer/react'
import { REPORT_REASONS } from '@/lib/report-reasons'

// "Ya no está aquí": two different people within 30 days turn the profile "pendiente" until the doctor confirms.
export default function ReportButton({ slug, name }: { slug: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>(REPORT_REASONS[0])
  const [result, setResult] = useState<{ ok: boolean; text: string }>()
  const [busy, setBusy] = useState(false)

  async function send() {
    setBusy(true)
    const res = await fetch('/api/reports', { method: 'POST', body: JSON.stringify({ slug, reason }) }).catch(() => null)
    const data = await res?.json().catch(() => null)
    setBusy(false)
    setResult({ ok: !!res?.ok, text: data?.message ?? data?.error ?? 'No pudimos enviar el reporte. Inténtalo de nuevo.' })
  }
  const close = () => { setOpen(false); setResult(undefined) }

  return (
    <>
      <Link as="button" type="button" className="small muted-link" onClick={() => setOpen(true)}>Ya no está aquí</Link>
      {open && (
        <Dialog
          title={`¿${name} ya no está aquí?`}
          onClose={close}
          footerButtons={result
            ? [{ content: 'Listo', buttonType: 'primary', onClick: close }]
            : [
                { content: 'Cancelar', onClick: close },
                { content: 'Enviar reporte', buttonType: 'primary', onClick: send, loading: busy },
              ]}
        >
          {result ? (
            <Flash variant={result.ok ? 'success' : 'danger'}>{result.text}</Flash>
          ) : (
            <>
              <p className="muted">Si dos personas lo reportan, el perfil pasa a &quot;pendiente&quot; hasta que el profesional confirme sus datos. Nadie tiene que borrarlo a mano.</p>
              <FormControl>
                <FormControl.Label>Motivo</FormControl.Label>
                <Select value={reason} onChange={(e) => setReason(e.target.value)} block>
                  {REPORT_REASONS.map((r) => <Select.Option key={r} value={r}>{r}</Select.Option>)}
                </Select>
              </FormControl>
            </>
          )}
        </Dialog>
      )}
    </>
  )
}
