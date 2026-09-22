'use client'
import { useState } from 'react'
import { Checkbox, FormControl } from '@primer/react'

const SIDE = 256

// Crops to a centred square and re-encodes to a 256×256 JPEG in the browser: small upload, EXIF (GPS) stripped.
async function shrink(file: File): Promise<File> {
  const img = await createImageBitmap(file)
  const side = Math.min(img.width, img.height)
  const canvas = Object.assign(document.createElement('canvas'), { width: SIDE, height: SIDE })
  canvas.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIDE, SIDE)
  const blob = await new Promise<Blob>((ok) => canvas.toBlob((b) => ok(b!), 'image/jpeg', 0.85))
  return new File([blob], 'foto.jpg', { type: 'image/jpeg' })
}

export default function PhotoInput({ current, error }: { current?: string; error?: string }) {
  const [preview, setPreview] = useState(current)
  const [problem, setProblem] = useState<string>()

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget
    const file = input.files?.[0]
    if (!file) return
    try {
      const small = await shrink(file)
      const dt = new DataTransfer()
      dt.items.add(small)
      input.files = dt.files
      setPreview(URL.createObjectURL(small))
      setProblem(undefined)
    } catch {
      input.value = ''
      setProblem('No pudimos leer esa imagen. Prueba con una foto JPG o PNG.')
    }
  }

  return (
    <div className="photo-input">
      {preview ? <img src={preview} alt="" className="avatar avatar-medium" /> : <span className="avatar avatar-medium" aria-hidden="true">?</span>}
      <div>
        <FormControl>
          <FormControl.Label>Foto o icono (opcional)</FormControl.Label>
          <input type="file" name="photo" accept="image/*" onChange={onChange} />
          <FormControl.Caption>Se recorta en cuadrado. Una foto tuya o el logo de tu consulta.</FormControl.Caption>
          {(problem || error) && <FormControl.Validation variant="error">{problem ?? error}</FormControl.Validation>}
        </FormControl>
        {current && (
          <FormControl>
            <Checkbox name="remove_photo" />
            <FormControl.Label>Quitar la foto</FormControl.Label>
          </FormControl>
        )}
      </div>
    </div>
  )
}
