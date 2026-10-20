import { Link } from 'react-router'
import { useLoadedSettings } from '../../contexts/SettingsContext'
import { IMAGE_CREDITS } from '../../lib/imageCredits'

/**
 * Rodapé "uma linha discreta" (TasteSkill): o que é a loja, alguns links e o ano.
 * O aviso regulatório fica legível em todas as páginas; os créditos das imagens de
 * acervo aberto são exigidos pelas licenças.
 */
export function Footer() {
  const s = useLoadedSettings()
  const year = new Date().getFullYear()
  const links = [
    { to: '/produtos', label: 'Produtos' },
    ...(s.policy_privacy ? [{ to: '/politicas/privacidade', label: 'Privacidade' }] : []),
    ...(s.policy_terms ? [{ to: '/politicas/termos', label: 'Termos' }] : []),
    ...(s.policy_shipping ? [{ to: '/politicas/entrega', label: 'Entregas e trocas' }] : []),
    { to: '/admin/login', label: 'Acesso da equipe' },
  ]
  const socials = [
    s.instagram_url && { href: s.instagram_url, label: 'Instagram' },
    s.facebook_url && { href: s.facebook_url, label: 'Facebook' },
    s.tiktok_url && { href: s.tiktok_url, label: 'TikTok' },
  ].filter(Boolean) as { href: string; label: string }[]
  const linkClass = 'inline-flex min-h-11 items-center text-ink hover:underline'

  return (
    <footer className="pb-24 md:pb-0">
      <div className="wrap pt-24 pb-6 md:pt-40">
        {(s.restricted_notice || s.footer_text || s.business_info) && (
          <div className="mb-10 grid gap-4 text-sm text-muted md:grid-cols-2">
            {s.restricted_notice && <p className="max-w-[62ch]">{s.restricted_notice}</p>}
            {(s.footer_text || s.business_info) && (
              <p className="max-w-[62ch] whitespace-pre-line">{[s.footer_text, s.business_info].filter(Boolean).join('\n')}</p>
            )}
          </div>
        )}
        <div className="grid gap-2 text-sm md:grid-cols-[1fr_auto_1fr] md:items-center">
          <p className="text-muted">
            {s.store_name}
            {s.slogan ? ` · ${s.slogan}` : ''}
          </p>
          <nav className="flex flex-wrap gap-x-6" aria-label="Rodapé">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className={linkClass}>
                {l.label}
              </Link>
            ))}
            {socials.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                {l.label}
              </a>
            ))}
          </nav>
          <p className="text-muted md:text-right">© {year}</p>
        </div>
        <p className="mt-6 text-xs text-muted">
          Imagens ilustrativas de acervos abertos:{' '}
          {IMAGE_CREDITS.map((c, i) => (
            <span key={c.url}>
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline">
                {c.title}
              </a>{' '}
              ({c.creator}, {c.license}){i < IMAGE_CREDITS.length - 1 ? '; ' : '.'}
            </span>
          ))}
        </p>
      </div>
    </footer>
  )
}
