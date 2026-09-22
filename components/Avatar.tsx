import { initials, type PublicDoctor } from '@/lib/directory'

// Photo if the doctor uploaded one, otherwise initials (GitHub-style round avatar).
export default function Avatar({ d, size }: { d: Pick<PublicDoctor, 'slug' | 'full_name' | 'photo_version'>; size: 'small' | 'row' | 'large' }) {
  return d.photo_version
    ? <img src={`/medico/${d.slug}/foto?v=${d.photo_version}`} alt="" className={`avatar avatar-${size}`} loading="lazy" />
    : <span className={`avatar avatar-${size}`} aria-hidden="true">{initials(d.full_name)}</span>
}
