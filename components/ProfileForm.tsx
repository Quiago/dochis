'use client'
import { useActionState } from 'react'
import { Button, Checkbox, CheckboxGroup, Flash, FormControl, Select, Textarea, TextInput } from '@primer/react'
import { saveProfile, type FormState } from '@/app/cuenta/actions'
import { COMMON_LANGUAGES, EMIRATES, REGULATOR_LABELS, REGULATORS } from '@/lib/profile'
import PhotoInput from './PhotoInput'

export type Initial = {
  full_name?: string; specialty?: string; clinic?: string; area?: string | null; emirate?: string
  languages?: string[]; insurances?: string[]; regulator?: string | null; license_number?: string | null
  show_license?: boolean
  public_whatsapp?: string | null
  insurance_url?: string | null
  public_email?: string | null
  links?: string[]
  hours_weekday_open?: string | null; hours_weekday_close?: string | null
  hours_weekend_open?: string | null; hours_weekend_close?: string | null
}

export default function ProfileForm({ initial, medico, loginPhone, submitLabel, photo }: { initial: Initial; medico?: string; loginPhone?: string; submitLabel: string; photo?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfile, {})
  const err = state.errors ?? {}
  const values = state.values
  // On a validation error, redisplay exactly what was typed (React resets an uncontrolled form otherwise);
  // without an error, fall back to the profile's current data.
  const langs = values ? values.languages : (initial.languages?.length ? initial.languages : ['Español'])
  const otherLangs = values ? values.other_languages : langs.filter((l) => !COMMON_LANGUAGES.includes(l)).join(', ')
  const field = (name: keyof Initial, label: string, opts: { required?: boolean; caption?: string; placeholder?: string } = {}) => (
    <FormControl required={opts.required}>
      <FormControl.Label>{label}</FormControl.Label>
      <TextInput name={name} defaultValue={values ? (values as unknown as Record<string, string>)[name] : ((initial[name] as string) ?? '')} placeholder={opts.placeholder} block maxLength={120} />
      {opts.caption && <FormControl.Caption>{opts.caption}</FormControl.Caption>}
      {err[name] && <FormControl.Validation variant="error">{err[name]}</FormControl.Validation>}
    </FormControl>
  )

  return (
    <form action={action} className="profile-form">
      {medico && <input type="hidden" name="medico" value={medico} />}
      {Object.keys(err).length > 0 && <Flash variant="danger">Revisa los campos marcados.</Flash>}

      <PhotoInput current={photo} error={err.photo} />
      {field('full_name', 'Nombre completo', { required: true, placeholder: 'Dra. Lucía Márquez' })}
      {field('specialty', 'Especialidad', { required: true, placeholder: 'Pediatría' })}
      {field('clinic', 'Clínica o centro', { required: true })}
      {field('area', 'Zona', { placeholder: 'Jumeirah, Al Reem…' })}

      <FormControl required>
        <FormControl.Label>Emirato</FormControl.Label>
        <Select name="emirate" defaultValue={values?.emirate ?? initial.emirate ?? 'Dubái'} block>
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
        <TextInput name="insurances" defaultValue={values ? values.insurances : (initial.insurances?.join(', ') ?? '')} placeholder="Daman, AXA, Thiqa…" block />
        <FormControl.Caption>Separados por comas. Si sabes la red o el plan, inclúyelo: «Daman Enhanced», «NAS GN».</FormControl.Caption>
        {err.insurances && <FormControl.Validation variant="error">{err.insurances}</FormControl.Validation>}
      </FormControl>

      <FormControl>
        <FormControl.Label>Lista de seguros de tu clínica (opcional)</FormControl.Label>
        <TextInput name="insurance_url" type="url" inputMode="url" defaultValue={values ? values.insurance_url : (initial.insurance_url ?? '')} placeholder="https://…" block />
        <FormControl.Caption>Muchas clínicas publican qué aseguradoras, planes y redes aceptan. Es la fuente más fiable para los pacientes.</FormControl.Caption>
        {err.insurance_url && <FormControl.Validation variant="error">{err.insurance_url}</FormControl.Validation>}
      </FormControl>

      <FormControl required>
        <FormControl.Label>Autoridad de tu licencia</FormControl.Label>
        <Select name="regulator" defaultValue={values?.regulator ?? initial.regulator ?? 'DHA'} block>
          {REGULATORS.map((r) => <Select.Option key={r} value={r}>{REGULATOR_LABELS[r]}</Select.Option>)}
        </Select>
        {err.regulator && <FormControl.Validation variant="error">{err.regulator}</FormControl.Validation>}
      </FormControl>
      {field('license_number', 'Número de licencia', { required: true, caption: 'La pedimos siempre: evita perfiles duplicados y suplantaciones.' })}
      <FormControl>
        <Checkbox name="show_license" defaultChecked={values ? values.show_license : (initial.show_license ?? true)} />
        <FormControl.Label>Publicar mi número de licencia</FormControl.Label>
        <FormControl.Caption>Si lo dejas sin marcar, tu perfil dirá solo en qué autoridad estás registrado, con el enlace al registro oficial.</FormControl.Caption>
      </FormControl>

      <FormControl>
        <Checkbox name="show_whatsapp" defaultChecked={values ? values.show_whatsapp : !!initial.public_whatsapp} />
        <FormControl.Label>Mostrar mi WhatsApp para que los pacientes me escriban</FormControl.Label>
      </FormControl>
      <FormControl>
        <FormControl.Label visuallyHidden>WhatsApp para pacientes</FormControl.Label>
        <TextInput name="public_whatsapp" type="tel" defaultValue={values ? values.public_whatsapp : (initial.public_whatsapp ?? loginPhone ?? '+971 ')} block />
        <FormControl.Caption>Solo se publica si marcas la casilla de arriba.</FormControl.Caption>
        {err.public_whatsapp && <FormControl.Validation variant="error">{err.public_whatsapp}</FormControl.Validation>}
      </FormControl>

      <FormControl>
        <FormControl.Label>Correo para pacientes (opcional)</FormControl.Label>
        <TextInput name="public_email" type="text" inputMode="email" autoComplete="email" defaultValue={values ? values.public_email : (initial.public_email ?? '')} block />
        <FormControl.Caption>Se publica tal cual. No es el correo con el que entras: ese no se publica nunca.</FormControl.Caption>
        {err.public_email && <FormControl.Validation variant="error">{err.public_email}</FormControl.Validation>}
      </FormControl>

      <FormControl>
        <FormControl.Label>Enlaces (opcional)</FormControl.Label>
        <Textarea name="links" defaultValue={values ? values.links : (initial.links ?? []).join('\n')} rows={3} block placeholder={'https://instagram.com/tu-cuenta\nhttps://tuclinica.ae'} />
        <FormControl.Caption>Uno por línea, hasta cinco: Instagram, LinkedIn, TikTok, X, Facebook, YouTube y una página web.</FormControl.Caption>
        {err.links && <FormControl.Validation variant="error">{err.links}</FormControl.Validation>}
      </FormControl>

      <fieldset className="hours">
        <legend>Horario de atención (opcional)</legend>
        <FormControl>
          <FormControl.Label>Entre semana</FormControl.Label>
          <div className="hours-row">
            <TextInput aria-label="Apertura entre semana" name="hours_weekday_open" type="time" defaultValue={values ? values.hours_weekday_open : (initial.hours_weekday_open?.slice(0, 5) ?? '')} />
            <TextInput aria-label="Cierre entre semana" name="hours_weekday_close" type="time" defaultValue={values ? values.hours_weekday_close : (initial.hours_weekday_close?.slice(0, 5) ?? '')} />
          </div>
          {err.hours_weekday && <FormControl.Validation variant="error">{err.hours_weekday}</FormControl.Validation>}
        </FormControl>
        <FormControl>
          <FormControl.Label>Fin de semana</FormControl.Label>
          <div className="hours-row">
            <TextInput aria-label="Apertura fin de semana" name="hours_weekend_open" type="time" defaultValue={values ? values.hours_weekend_open : (initial.hours_weekend_open?.slice(0, 5) ?? '')} />
            <TextInput aria-label="Cierre fin de semana" name="hours_weekend_close" type="time" defaultValue={values ? values.hours_weekend_close : (initial.hours_weekend_close?.slice(0, 5) ?? '')} />
          </div>
          {err.hours_weekend && <FormControl.Validation variant="error">{err.hours_weekend}</FormControl.Validation>}
        </FormControl>
        <p className="muted small">Déjalo vacío si prefieres no publicarlo. Lo revisas cada mes al guardar tu perfil.</p>
      </fieldset>

      <FormControl required>
        <Checkbox name="consent" defaultChecked={values?.consent ?? false} />
        <FormControl.Label>Acepto que se publiquen en el directorio los datos profesionales que he rellenado.</FormControl.Label>
        {err.consent && <FormControl.Validation variant="error">{err.consent}</FormControl.Validation>}
      </FormControl>

      <Button type="submit" variant="primary" block loading={pending}>{submitLabel}</Button>
    </form>
  )
}
