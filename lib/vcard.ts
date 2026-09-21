// Directory contact card, so doctors save the number that sends reminders.
export function vcard({ name, phone, email, url }: { name: string; phone: string; email: string; url: string }) {
  return [
    'BEGIN:VCARD', 'VERSION:3.0', `FN:${name}`, `ORG:${name}`,
    phone && `TEL;TYPE=CELL:+${phone}`, email && `EMAIL:${email}`, `URL:${url}`, 'END:VCARD', '',
  ].filter((l) => l !== '').join('\r\n') + '\r\n'
}
