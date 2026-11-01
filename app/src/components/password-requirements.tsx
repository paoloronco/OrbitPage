import { useId, useState } from 'react';
import { Info } from 'lucide-react';

export default function PasswordRequirements({ password, tr }: { password: string; tr: (english: string, italian: string) => string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return <div className="account-password-help" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <button type="button" onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); } }} aria-expanded={open} aria-label={tr('Password requirements', 'Requisiti della password')} aria-describedby={id}><Info aria-hidden="true" size={16} /></button>
    <div className="password-requirements" id={id} role="tooltip" hidden={!open}>
      <strong>{tr('Password requirements', 'Requisiti della password')}</strong>
      <ul>
        <li data-valid={password.length >= 8}>{tr('At least 8 characters', 'Almeno 8 caratteri')}</li>
        <li data-valid={/[A-Z]/.test(password)}>{tr('Uppercase letter', 'Lettera maiuscola')}</li>
        <li data-valid={/[a-z]/.test(password)}>{tr('Lowercase letter', 'Lettera minuscola')}</li>
        <li data-valid={/\d/.test(password)}>{tr('Number', 'Numero')}</li>
        <li data-valid={/[!@#$%^&*(),.?":{}|<>]/.test(password)}>{tr('Special character', 'Carattere speciale')}</li>
      </ul>
    </div>
  </div>;
}
