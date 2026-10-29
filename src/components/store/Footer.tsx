import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { useLoadedSettings } from '../../contexts/SettingsContext'
import { whatsappLink } from '../../lib/whatsapp'
import { InstallButton } from './InstallApp'

function formatPhone(digits: string) {
  const d = digits.replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digits
}

type FooterLink = { label: string; to?: string; href?: string }

/**
 * Rodapé claro do sistema: a marca à esquerda, colunas de links e, embaixo, a faixa
 * legal (aviso regulatório, dados da empresa e o ano), sempre legível.
 */
export function Footer() {
  const s = useLoadedSettings()
  const year = new Date().getFullYear()

  const columns: { title: string; links: FooterLink[] }[] = [
    {
      title: 'Loja',
      links: [
        { label: 'Início', to: '/' },
        { label: 'Produtos', to: '/produtos' },
        { label: s.sales_mode === 'quote' ? 'Orçamento' : 'Carrinho', to: '/carrinho' },
        { label: 'Minha conta', to: '/minha-conta' },
      ],
    },
    {
      title: 'Ajuda',
      links: [
        ...(s.policy_shipping ? [{ label: 'Entregas e trocas', to: '/politicas/entrega' }] : []),
        ...(s.policy_privacy ? [{ label: 'Privacidade', to: '/politicas/privacidade' }] : []),
        ...(s.policy_terms ? [{ label: 'Termos de uso', to: '/politicas/termos' }] : []),
        { label: 'Acesso da equipe', to: '/admin/login' },
      ],
    },
    {
      title: 'Contato',
      links: [
        ...(s.whatsapp_number
          ? [{ label: `WhatsApp ${formatPhone(s.whatsapp_number)}`, href: whatsappLink(s.whatsapp_number, `Olá, ${s.store_name}!`) }]
          : []),
        ...(s.contact_email ? [{ label: s.contact_email, href: `mailto:${s.contact_email}` }] : []),
        ...(s.address ? [{ label: s.address, href: `https://www.google.com/maps/search/${encodeURIComponent(s.address)}` }] : []),
        ...(s.opening_hours ? [{ label: s.opening_hours }] : []),
      ],
    },
    {
      title: 'Redes',
      links: [
        ...(s.instagram_url ? [{ label: 'Instagram', href: s.instagram_url }] : []),
        ...(s.facebook_url ? [{ label: 'Facebook', href: s.facebook_url }] : []),
        ...(s.tiktok_url ? [{ label: 'TikTok', href: s.tiktok_url }] : []),
      ],
    },
  ].filter((c) => c.links.length > 0)

  const linkClass = 'inline-flex min-h-11 items-center text-sm text-body hover:text-ink md:min-h-9'

  return (
    <footer className="border-t border-hairline bg-white pb-20 md:pb-0">
      <div
        className="wrap grid grid-cols-2 gap-x-6 gap-y-10 py-14 md:grid-cols-[1.4fr_repeat(var(--cols),minmax(0,1fr))] lg:py-16"
        style={{ '--cols': columns.length } as CSSProperties}
      >
        <div className="col-span-2 md:col-span-1">
          <p className="text-lg font-semibold text-ink">{s.store_name}</p>
          {s.slogan && <p className="mt-1 max-w-[28ch] text-sm text-body">{s.slogan}</p>}
          <InstallButton className="btn-outline mt-5 min-h-10 px-4 text-sm" />
        </div>
        {columns.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="text-sm font-semibold text-ink">{c.title}</h2>
            <ul className="mt-3">
              {c.links.map((l) => (
                <li key={l.label}>
                  {l.to ? (
                    <Link to={l.to} className={linkClass}>
                      {l.label}
                    </Link>
                  ) : l.href ? (
                    <a
                      href={l.href}
                      target={l.href.startsWith('mailto') ? undefined : '_blank'}
                      rel="noopener noreferrer"
                      className={linkClass}
                    >
                      {l.label}
                    </a>
                  ) : (
                    <span className="inline-flex min-h-9 items-center text-sm text-body">{l.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* Faixa legal */}
      <div className="border-t border-hairline">
        <div className="wrap grid gap-3 py-6 text-xs text-body md:grid-cols-[1fr_auto] md:items-start">
          <div className="space-y-2">
            {s.restricted_notice && <p className="max-w-[90ch]">{s.restricted_notice}</p>}
            {(s.footer_text || s.business_info) && (
              <p className="max-w-[90ch] whitespace-pre-line">{[s.footer_text, s.business_info].filter(Boolean).join('\n')}</p>
            )}
          </div>
          <p className="md:text-right">
            © {year} {s.store_name}
          </p>
        </div>
      </div>
    </footer>
  )
}
