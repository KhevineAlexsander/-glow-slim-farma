import { useEffect, useState } from 'react'
import { centsToInput, formatBRL, MAX_PRICE_CENTS, parseBRLToCents } from '../../lib/money'
import { NO_DISCOUNT, type OrderDiscount } from '../../lib/orderDiscount'

type Mode = 'value' | 'percent'

function toText(d: OrderDiscount) {
  if (d.discount_percent != null) return String(d.discount_percent).replace('.', ',')
  return d.discount_cents > 0 ? centsToInput(d.discount_cents) : ''
}

/** Desconto do pedido em R$ ou %. Aplica ao sair do campo, com Enter ou ao trocar a unidade. */
export function OrderDiscountField({
  value,
  appliedCents,
  disabled = false,
  onChange,
}: {
  value: OrderDiscount
  /** Quanto o desconto representa de fato sobre os itens atuais. */
  appliedCents: number
  disabled?: boolean
  onChange: (next: OrderDiscount) => void
}) {
  const [mode, setMode] = useState<Mode>(value.discount_percent != null ? 'percent' : 'value')
  const [text, setText] = useState(toText(value))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMode(value.discount_percent != null ? 'percent' : 'value')
    setText(toText(value))
    setError(null)
  }, [value.discount_cents, value.discount_percent])

  const commit = (m: Mode, raw: string) => {
    const trimmed = raw.trim()
    const cents = trimmed === '' ? 0 : parseBRLToCents(trimmed)
    if (cents == null) return setError('Valor inválido.')
    if (m === 'percent' && cents > 10000) return setError('O percentual máximo é 100%.')
    if (m === 'value' && cents > MAX_PRICE_CENTS) return setError('Valor muito alto.')
    setError(null)
    const next: OrderDiscount =
      cents === 0
        ? NO_DISCOUNT
        : m === 'percent'
          ? { discount_cents: 0, discount_percent: cents / 100 }
          : { discount_cents: cents, discount_percent: null }
    if (next.discount_cents !== value.discount_cents || next.discount_percent !== value.discount_percent) onChange(next)
  }

  const units: [Mode, string][] = [
    ['value', 'R$'],
    ['percent', '%'],
  ]

  return (
    <div className="mt-3 border-t border-hairline pt-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink" id="desconto-label">Desconto</span>
          <div className="flex items-center rounded-full bg-surface-strong p-1" role="group" aria-label="Unidade do desconto">
            {units.map(([m, label]) => (
              <button
                key={m}
                type="button"
                disabled={disabled}
                aria-pressed={mode === m}
                className={`min-h-8 min-w-9 rounded-full px-2 text-sm ${mode === m ? 'bg-white font-medium text-ink' : 'text-body'}`}
                onClick={() => {
                  setMode(m)
                  if (text.trim()) commit(m, text)
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            aria-labelledby="desconto-label"
            inputMode="decimal"
            placeholder="0,00"
            disabled={disabled}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setError(null)
            }}
            onBlur={() => commit(mode, text)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            className={`h-10 w-24 rounded-lg border bg-white px-2.5 text-right text-base outline-none focus:ring-2 focus:ring-brand/20 sm:text-sm ${
              error ? 'border-red-400' : 'border-slate-200 focus:border-brand'
            }`}
          />
        </div>
        {appliedCents > 0 && <span className="tabular font-medium text-[#247b50]">− {formatBRL(appliedCents)}</span>}
      </div>
      {error && <p className="mt-1 text-xs text-[#a51a26]">{error}</p>}
    </div>
  )
}
