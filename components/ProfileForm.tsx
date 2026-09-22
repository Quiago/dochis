'use client'
import { useActionState } from 'react'
import { Button, Checkbox, CheckboxGroup, Flash, FormControl, Select, TextInput } from '@primer/react'
import { saveProfile, type FormState } from '@/app/cuenta/actions'
import { COMMON_LANGUAGES, EMIRATES, REGULATOR_LABELS, REGULATORS } from '@/lib/profile'

export type Initial = {
  full_name?: string; specialty?: string; clinic?: string; area?: string | null; emirate?: string
  languages?: string[]; insurances?: string[]; regulator?: string | null; license_number?: string | null
  public_whatsapp?: string | null
  insurance_url?: string | null
}

export default function ProfileForm({ initial, medico, loginPhone, submitLabel }: { initial: Initial; medico?: string; loginPhone?: string; submitLabel: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfile, {})
  const err = state.errors ?? {}
  const langs = initial.languages?.length ? initial.languages : ['Español']
  const otherLangs = langs.filter((l) => !COMMON_LANGUAGES.includes(l)).join(', ')
  const field = (name: keyof Initial, label: string, opts: { required?: boolean; caption?: string; placeholder?: string } = {}) => (
    <FormControl required={opts.required}>
      <FormControl.Label>{label}</FormControl.Label>
      <TextInput name={name} defaultValue={(initial[name] as string) ?? ''} placeholder={opts.placeholder} block maxLength={120} />
      {opts.caption && <FormControl.Caption>{opts.caption}</FormControl.Caption>}
      {err[name] && <FormControl.Validation variant="error">{err[name]}</FormControl.Validation>}
    </FormControl>
  )

  return (
    <form action={action} className="profile-form">
      {medico && <input type="hidden" name="medico" value={medico} />}
      {Object.keys(err).length > 0 && <Flash variant="danger">Revisa los campos marcados.</Flash>}

      {field('full_name', 'Nombre completo', { required: true, placeholder: 'Dra. Lucía Márquez' })}
      {field('specialty', 'Especialidad', { required: true, placeholder: 'Pediatría' })}
      {field('clinic', 'Clínica o centro', { required: true })}
      {field('area', 'Zona', { placeholder: 'Jumeirah, Al Reem…' })}

      <FormControl required>
        <FormControl.Label>Emirato</FormControl.Label>
        <Select name="emirate" defaultValue={initial.emirate ?? 'Dubái'} block>
          {EMIRATES.map((e) => <Select.Option key={e} value={e}>{e}</Select.Option>)}
        </Select>
        {err.emirate && <FormControl.Validation variant="error">{err.emirate}</FormControl.Validation>}
      </FormControl>

      <CheckboxGroup>
        <CheckboxGroup.Label>Idiomas en los que atiendes</CheckboxGroup.Label>
        <div className="checks">
          {COMMON_LANGUAGES.map((l) => (
            <FormControl key={l}>
              <Checkbox name="languages" value={l} defaultChecked={langs.includes(l)} />
              <FormControl.Label>{l}</FormControl.Label>
            </FormControl>
          ))}
        </div>
        {err.languages && <CheckboxGroup.Validation variant="error">{err.languages}</CheckboxGroup.Validation>}
      </CheckboxGroup>
      <FormControl>
        <FormControl.Label>Otros idiomas</FormControl.Label>
        <TextInput name="other_languages" defaultValue={otherLangs} placeholder="Separados por comas" block />
      </FormControl>

      <FormControl>
        <FormControl.Label>Seguros aceptados</FormControl.Label>
        <TextInput name="insurances" defaultValue={initial.insurances?.join(', ') ?? ''} placeholder="Daman, AXA, Thiqa…" block />
        <FormControl.Caption>Separados por comas. Si sabes la red o el plan, inclúyelo: «Daman Enhanced», «NAS GN».</FormControl.Caption>
        {err.insurances && <FormControl.Validation variant="error">{err.insurances}</FormControl.Validation>}
      </FormControl>

      <FormControl>
        <FormControl.Label>Lista de seguros de tu clínica (opcional)</FormControl.Label>
        <TextInput name="insurance_url" type="url" inputMode="url" defaultValue={initial.insurance_url ?? ''} placeholder="https://…" block />
        <FormControl.Caption>Muchas clínicas publican qué aseguradoras, planes y redes aceptan. Es la fuente más fiable para los pacientes.</FormControl.Caption>
        {err.insurance_url && <FormControl.Validation variant="error">{err.insurance_url}</FormControl.Validation>}
      </FormControl>

      <FormControl required>
        <FormControl.Label>Autoridad de tu licencia</FormControl.Label>
        <Select name="regulator" defaultValue={initial.regulator ?? 'DHA'} block>
          {REGULATORS.map((r) => <Select.Option key={r} value={r}>{REGULATOR_LABELS[r]}</Select.Option>)}
        </Select>
        {err.regulator && <FormControl.Validation variant="error">{err.regulator}</FormControl.Validation>}
      </FormControl>
      {field('license_number', 'Número de licencia', { required: true, caption: 'Se publica junto a un enlace al registro oficial, para que cualquiera pueda comprobarla.' })}

      <FormControl>
        <Checkbox name="show_whatsapp" defaultChecked={!!initial.public_whatsapp} />
        <FormControl.Label>Mostrar mi WhatsApp para que los pacientes me escriban</FormControl.Label>
      </FormControl>
      <FormControl>
        <FormControl.Label visuallyHidden>WhatsApp para pacientes</FormControl.Label>
        <TextInput name="public_whatsapp" type="tel" defaultValue={initial.public_whatsapp ?? loginPhone ?? '+971 '} block />
        <FormControl.Caption>Solo se publica si marcas la casilla de arriba.</FormControl.Caption>
        {err.public_whatsapp && <FormControl.Validation variant="error">{err.public_whatsapp}</FormControl.Validation>}
      </FormControl>

      <FormControl required>
        <Checkbox name="consent" />
        <FormControl.Label>Acepto que se publiquen mis datos profesionales, incluido mi número de licencia, en el directorio.</FormControl.Label>
        {err.consent && <FormControl.Validation variant="error">{err.consent}</FormControl.Validation>}
      </FormControl>

      <Button type="submit" variant="primary" block loading={pending}>{submitLabel}</Button>
    </form>
  )
}
