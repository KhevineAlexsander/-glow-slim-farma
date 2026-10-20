import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { AdminPageHeader } from '../../components/admin/AdminLayout'
import { ImageInput } from '../../components/admin/ImageInput'
import { ErrorBox, PageLoader, Toggle } from '../../components/ui/misc'
import { useToast } from '../../components/ui/Toast'
import { useSettings } from '../../contexts/SettingsContext'
import { friendlyError } from '../../lib/supabase'
import { onlyDigits } from '../../lib/whatsapp'
import { updateSettings } from '../../services/admin'
import type { StoreSettings } from '../../types'

const TABS = ['Loja', 'Contato', 'Vendas', 'Página inicial', 'Aparência', 'Políticas'] as const
type Tab = (typeof TABS)[number]

const DEFAULT_COLORS = {
  primary_color: '#1677F2',
  primary_dark_color: '#0756B5',
  accent_color: '#22A9E8',
  light_color: '#EAF8FF',
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export default function SettingsPage() {
  const { settings, reload } = useSettings()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('Loja')
  const [s, setS] = useState<StoreSettings | null>(settings)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (settings && !s) setS(settings)
  }, [settings, s])

  if (!s) return <PageLoader />

  const set = <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => setS({ ...s, [k]: v })
  const text = (k: keyof StoreSettings, max?: number) => ({
    value: (s[k] as string | null) ?? '',
    maxLength: max,
    onChange: (e: { target: { value: string } }) => set(k, e.target.value as never),
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!s.store_name.trim()) return setError('Informe o nome da loja.')
    const whatsapp = s.whatsapp_number ? onlyDigits(s.whatsapp_number) : ''
    if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15)) {
      return setError('WhatsApp inválido. Use DDI + DDD + número, ex.: 5511999999999.')
    }
    for (const k of ['primary_color', 'primary_dark_color', 'accent_color', 'light_color'] as const) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(s[k])) return setError('Cores devem estar no formato #RRGGBB.')
    }
    for (const k of ['instagram_url', 'facebook_url', 'tiktok_url'] as const) {
      const v = s[k]?.trim()
      if (v && !/^https?:\/\//i.test(v)) return setError('Links de redes sociais devem começar com https://')
    }

    // Campos de texto vazios viram null
    const patch: Partial<StoreSettings> = {}
    for (const [k, v] of Object.entries(s)) {
      if (k === 'id' || k === 'updated_at') continue
      ;(patch as Record<string, unknown>)[k] = typeof v === 'string' ? v.trim() || null : v
    }
    patch.whatsapp_number = whatsapp || null
    for (const k of ['store_name', 'categories_title', 'featured_title', 'bestsellers_title', 'offers_title'] as const) {
      patch[k] = s[k].trim() || settings![k]
    }

    setSaving(true)
    try {
      const saved = await updateSettings(patch)
      setS(saved)
      await reload()
      toast('Configurações salvas.')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl pb-24">
      <AdminPageHeader title="Configurações" />

      <div className="mb-6 flex gap-6 overflow-x-auto border-b border-[#e8e8e8] [scrollbar-width:none]" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            role="tab"
            aria-selected={tab === t}
            className={`-mb-px h-11 shrink-0 border-b-2 px-1 text-sm ${tab === t ? 'border-ink font-medium text-ink' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="card space-y-4 p-4 sm:p-6" role="tabpanel" aria-label={tab}>
        {tab === 'Loja' && (
          <>
            <Field label="Nome da loja *"><input className="input" required {...text('store_name', 80)} /></Field>
            <Field label="Slogan"><input className="input" {...text('slogan', 120)} /></Field>
            <ImageInput label="Logo" folder="branding" value={s.logo_url} onChange={(url) => set('logo_url', url)} hint="Se vazio, usa a logo padrão Glow Slim Farma." />
            <Toggle checked={s.announcement_active} onChange={(v) => set('announcement_active', v)} label="Exibir aviso no topo do site" />
            <Field label="Texto do aviso"><input className="input" placeholder="Ex.: Atendimento de seg. a sex., 9h às 18h" {...text('announcement_text', 200)} /></Field>
            <Field label="Texto do rodapé"><textarea className="input min-h-20 py-2" {...text('footer_text', 500)} /></Field>
          </>
        )}

        {tab === 'Contato' && (
          <>
            <Field label="WhatsApp" hint="Somente números, com DDI e DDD. Ex.: 5511999999999. Se vazio, os botões de WhatsApp não aparecem.">
              <input className="input" inputMode="tel" {...text('whatsapp_number', 20)} />
            </Field>
            <Field label="Telefone"><input className="input" {...text('contact_phone', 40)} /></Field>
            <Field label="E-mail"><input className="input" type="email" {...text('contact_email', 120)} /></Field>
            <Field label="Horário de atendimento"><input className="input" {...text('opening_hours', 200)} /></Field>
            <Field label="Instagram (link)"><input className="input" placeholder="https://instagram.com/…" {...text('instagram_url', 300)} /></Field>
            <Field label="Facebook (link)"><input className="input" {...text('facebook_url', 300)} /></Field>
            <Field label="TikTok (link)"><input className="input" {...text('tiktok_url', 300)} /></Field>
            <Field label="Endereço"><input className="input" {...text('address', 300)} /></Field>
            <Field label="Informações comerciais" hint="Razão social, CNPJ, responsável técnico, autorização de funcionamento etc.">
              <textarea className="input min-h-20 py-2" {...text('business_info', 500)} />
            </Field>
          </>
        )}

        {tab === 'Vendas' && (
          <>
            <Field label="Modo de atendimento">
              <select className="input" value={s.sales_mode} onChange={(e) => set('sales_mode', e.target.value as StoreSettings['sales_mode'])}>
                <option value="quote">Orçamento — o cliente monta uma lista e envia para cotação</option>
                <option value="order">Compra — carrinho com pedido (somente produtos com preço e sem restrição)</option>
              </select>
            </Field>
            <p className="rounded-lg bg-[#f6f8fb] p-3 text-xs text-muted">
              Em ambos os modos o pedido/orçamento é registrado no painel (menu Pedidos). Não há pagamento online: a loja
              confirma valores, pagamento e entrega diretamente com o cliente.
            </p>
            <Toggle
              checked={s.send_to_whatsapp}
              onChange={(v) => set('send_to_whatsapp', v)}
              label="Oferecer envio do resumo pelo WhatsApp após o pedido"
              description="Requer número de WhatsApp na aba Contato."
            />
            <Field label="Como exibir produtos sem preço">
              <select className="input" value={s.no_price_label} onChange={(e) => set('no_price_label', e.target.value as StoreSettings['no_price_label'])}>
                <option value="consult">“Preço sob consulta”</option>
                <option value="whatsapp">“Consulte pelo WhatsApp”</option>
              </select>
            </Field>
            <Field label="Aviso sobre produtos com prescrição/venda restrita">
              <textarea className="input min-h-24 py-2" {...text('restricted_notice', 600)} />
            </Field>
          </>
        )}

        {tab === 'Página inicial' && (
          <>
            <Toggle checked={s.show_categories} onChange={(v) => set('show_categories', v)} label="Mostrar categorias" />
            <Field label="Título das categorias"><input className="input" {...text('categories_title', 60)} /></Field>
            <Toggle checked={s.show_featured} onChange={(v) => set('show_featured', v)} label="Mostrar destaques" />
            <Field label="Título dos destaques"><input className="input" {...text('featured_title', 60)} /></Field>
            <Toggle checked={s.show_bestsellers} onChange={(v) => set('show_bestsellers', v)} label="Mostrar mais vendidos" />
            <Field label="Título dos mais vendidos"><input className="input" {...text('bestsellers_title', 60)} /></Field>
            <Toggle checked={s.show_offers} onChange={(v) => set('show_offers', v)} label="Mostrar ofertas especiais" />
            <Field label="Título das ofertas"><input className="input" {...text('offers_title', 60)} /></Field>
            <Toggle checked={s.show_secondary_banners} onChange={(v) => set('show_secondary_banners', v)} label="Mostrar banners secundários" />
            <p className="text-xs text-slate-500">
              Os produtos de cada seção são escolhidos no cadastro do produto (Destaque, Mais vendido, Oferta). Seções
              sem produtos não aparecem.
            </p>
          </>
        )}

        {tab === 'Aparência' && (
          <>
            {(
              [
                ['primary_color', 'Azul principal'],
                ['primary_dark_color', 'Azul escuro'],
                ['accent_color', 'Ciano (destaque)'],
                ['light_color', 'Azul claro (fundos)'],
              ] as const
            ).map(([k, label]) => (
              <div key={k} className="flex items-center gap-3">
                <input type="color" aria-label={label} className="h-11 w-14 cursor-pointer rounded-lg border border-slate-200" value={s[k]} onChange={(e) => set(k, e.target.value.toUpperCase())} />
                <Field label={label}><input className="input max-w-32 font-mono" {...text(k, 7)} /></Field>{/* taste-skill-ignore: código hexadecimal da cor */}
              </div>
            ))}
            <button type="button" className="btn-outline" onClick={() => setS({ ...s, ...DEFAULT_COLORS })}>
              Restaurar cores padrão
            </button>
          </>
        )}

        {tab === 'Políticas' && (
          <>
            <p className="text-xs text-slate-500">Páginas com texto preenchido aparecem como links no rodapé.</p>
            <Field label="Política de privacidade"><textarea className="input min-h-40 py-2" {...text('policy_privacy', 20000)} /></Field>
            <Field label="Termos de uso"><textarea className="input min-h-40 py-2" {...text('policy_terms', 20000)} /></Field>
            <Field label="Entregas e trocas"><textarea className="input min-h-40 py-2" {...text('policy_shipping', 20000)} /></Field>
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#e8e8e8] bg-white p-3 lg:right-[9px] lg:bottom-[9px] lg:left-[241px] lg:rounded-b-2xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {error && <div className="flex-1"><ErrorBox message={error} /></div>}
          <button type="submit" className="btn-primary ml-auto min-w-40" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar configurações'}
          </button>
        </div>
      </div>
    </form>
  )
}
