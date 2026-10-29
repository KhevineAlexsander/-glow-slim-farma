import { useState, type FormEvent } from 'react'
import { AdminPageHeader } from '../../components/admin/AdminLayout'
import { useToast } from '../../components/ui/Toast'
import { ErrorBox, PageLoader } from '../../components/ui/misc'
import { useSettings } from '../../contexts/SettingsContext'
import { centsToInput, formatBRL, parseBRLToCents } from '../../lib/money'
import { friendlyError } from '../../lib/supabase'
import { updateSettings } from '../../services/admin'

const SUGGESTIONS = [0, 10000, 15000, 18000, 25000]

/**
 * Pedido mínimo: o único valor desta tela. Salva só min_order_cents, para não
 * sobrescrever outras configurações. O banco confere o mínimo de novo ao gravar
 * cada pedido de compra.
 */
export default function MinOrderPage() {
  const { settings, reload } = useSettings()
  const toast = useToast()
  const [value, setValue] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!settings) return <PageLoader />
  const current = settings.min_order_cents ?? 0
  const text = value ?? centsToInput(current)
  const cents = parseBRLToCents(text)
  const valid = cents != null && cents >= 0 && cents <= 10_000_000
  const changed = valid && cents !== current

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!valid) return setError('Digite um valor válido, por exemplo 180,00.')
    setSaving(true)
    try {
      await updateSettings({ min_order_cents: cents })
      await reload()
      setValue(null)
      toast(cents === 0 ? 'Pedido mínimo removido.' : `Pedido mínimo salvo: ${formatBRL(cents)}.`)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <AdminPageHeader
        title="Pedido mínimo"
        subtitle={current > 0 ? `Hoje a loja aceita compras a partir de ${formatBRL(current)}.` : 'Hoje a loja não tem pedido mínimo.'}
      />

      <form onSubmit={save} className="card space-y-5 p-6">
        <label className="block">
          <span className="label">Valor mínimo da compra (R$)</span>
          <div className="relative max-w-56">
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-base text-body">R$</span>
            <input
              className="input pl-11 tabular"
              inputMode="decimal"
              value={text}
              onChange={(e) => setValue(e.target.value)}
              aria-describedby="min-ajuda"
            />
          </div>
          <span id="min-ajuda" className="mt-1.5 block text-xs text-body">
            Use 0 para não ter mínimo. Vale para compras; orçamentos não têm mínimo.
          </span>
        </label>

        <div className="flex flex-wrap gap-2" aria-label="Valores rápidos">
          {SUGGESTIONS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setValue(centsToInput(v))}
              className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-medium ${
                cents === v ? 'bg-ink text-white' : 'bg-surface-strong text-ink hover:bg-hairline'
              }`}
            >
              {v === 0 ? 'Sem mínimo' : formatBRL(v)}
            </button>
          ))}
        </div>

        {/* como o cliente vai ver no carrinho */}
        {valid && cents > 0 && (
          <div className="rounded-2xl bg-surface-soft p-4">
            <p className="text-xs font-semibold text-body">Como aparece no carrinho (exemplo com R$ 30,00)</p>
            <div className="mt-2 flex items-baseline justify-between gap-3 text-xs text-body">
              <span>Pedido mínimo {formatBRL(cents)}</span>
              <span className="tabular font-semibold text-ink">
                {cents > 3000 ? `Faltam ${formatBRL(cents - 3000)}` : 'Mínimo atingido'}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-surface-strong">
              <div className="h-1.5 rounded-full bg-brand-dark" style={{ width: `${Math.min(100, (3000 / cents) * 100)}%` }} />
            </div>
          </div>
        )}

        {error && <ErrorBox message={error} />}
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={saving || !changed}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          {value != null && changed && (
            <button type="button" className="btn-ghost" onClick={() => setValue(null)}>
              Desfazer
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
