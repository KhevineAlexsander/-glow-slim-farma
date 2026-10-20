import { Clock, Mail, MapPin, MessageCircle, Phone, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router'
import { useLoadedSettings } from '../../contexts/SettingsContext'
import { whatsappLink } from '../../lib/whatsapp'

function Instagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function Facebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v7h4v-7h3l.5-4h-3.5V8.8c0-.5.3-.8.5-.8z" />
    </svg>
  )
}

function formatPhone(digits: string) {
  const d = digits.replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digits
}

export function Footer() {
  const s = useLoadedSettings()
  const policies = [
    s.policy_privacy && { to: '/politicas/privacidade', label: 'Política de privacidade' },
    s.policy_terms && { to: '/politicas/termos', label: 'Termos de uso' },
    s.policy_shipping && { to: '/politicas/entrega', label: 'Entregas e trocas' },
  ].filter(Boolean) as { to: string; label: string }[]

  return (
    <footer className="mt-16 bg-brand-dark pb-24 text-white/90 md:pb-0">
      {s.restricted_notice && (
        <div className="bg-black/15">
          <p className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-3 text-xs text-white/80">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            {s.restricted_notice}
          </p>
        </div>
      )}
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-extrabold text-white">{s.store_name}</p>
          {s.slogan && <p className="mt-1 text-sm text-white/70">{s.slogan}</p>}
          {s.footer_text && <p className="mt-3 text-sm whitespace-pre-line text-white/70">{s.footer_text}</p>}
        </div>

        <div>
          <p className="mb-3 font-bold text-white">Contato</p>
          <ul className="space-y-2 text-sm">
            {s.whatsapp_number && (
              <li>
                <a
                  href={whatsappLink(s.whatsapp_number)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-white"
                >
                  <MessageCircle className="size-4" /> {formatPhone(s.whatsapp_number)}
                </a>
              </li>
            )}
            {s.contact_phone && (
              <li className="flex items-center gap-2">
                <Phone className="size-4" /> {s.contact_phone}
              </li>
            )}
            {s.contact_email && (
              <li>
                <a href={`mailto:${s.contact_email}`} className="flex items-center gap-2 hover:text-white">
                  <Mail className="size-4" /> {s.contact_email}
                </a>
              </li>
            )}
            {s.opening_hours && (
              <li className="flex items-center gap-2">
                <Clock className="size-4" /> {s.opening_hours}
              </li>
            )}
          </ul>
        </div>

        <div>
          {(s.address || s.business_info) && <p className="mb-3 font-bold text-white">Informações</p>}
          {s.address && (
            <p className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0" /> {s.address}
            </p>
          )}
          {s.business_info && <p className="mt-2 text-sm whitespace-pre-line text-white/70">{s.business_info}</p>}
        </div>

        <div>
          {(s.instagram_url || s.facebook_url || s.tiktok_url) && (
            <>
              <p className="mb-3 font-bold text-white">Redes sociais</p>
              <div className="flex gap-2">
                {s.instagram_url && (
                  <a href={s.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
                    <Instagram className="size-5" />
                  </a>
                )}
                {s.facebook_url && (
                  <a href={s.facebook_url} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
                    <Facebook className="size-5" />
                  </a>
                )}
                {s.tiktok_url && (
                  <a href={s.tiktok_url} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="flex h-11 items-center justify-center rounded-full bg-white/10 px-4 text-sm font-bold hover:bg-white/20">
                    TikTok
                  </a>
                )}
              </div>
            </>
          )}
          {policies.length > 0 && (
            <ul className="mt-6 space-y-2 text-sm">
              {policies.map((p) => (
                <li key={p.to}>
                  <Link to={p.to} className="hover:text-white hover:underline">
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/60">
        © {new Date().getFullYear()} {s.store_name}. Todos os direitos reservados.
        <span className="mx-2">·</span>
        <Link to="/admin/login" className="inline-flex min-h-11 items-center hover:text-white hover:underline">
          Acesso da equipe
        </Link>
      </div>
    </footer>
  )
}
