import { Check, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { centsToInput, MAX_PRICE_CENTS, parseBRLToCents } from '../../lib/money'

/**
 * Campo de preço editável na listagem. Salva ao sair do campo ou com Enter.
 * `allowEmpty` = campo opcional (preço promocional): vazio vira null.
 */
export function PriceCell({
  cents,
  onSave,
  allowEmpty = false,
  label,
}: {
  cents: number | null
  onSave: (value: number | null) => Promise<boolean>
  allowEmpty?: boolean
  label: string
}) {
  const initial = cents == null || (!allowEmpty && cents === 0) ? '' : centsToInput(cents)
  const [text, setText] = useState(initial)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    setText(initial)
  }, [initial])

  const commit = async () => {
    if (text === initial) return
    const trimmed = text.trim()
    let value: number | null
    if (trimmed === '') {
      value = allowEmpty ? null : 0
    } else {
      value = parseBRLToCents(trimmed)
      if (value == null || value > MAX_PRICE_CENTS || (allowEmpty && value === 0)) {
        setState('error')
        return
      }
    }
    setState('saving')
    const ok = await onSave(value)
    setState(ok ? 'saved' : 'error')
    if (!ok) setText(initial)
    else setTimeout(() => setState('idle'), 1500)
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-slate-500">R$</span>
      <input
        aria-label={label}
        inputMode="decimal"
        placeholder={allowEmpty ? '—' : '0,00'}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setState('idle')
        }}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') setText(initial)
        }}
        className={`h-10 w-28 rounded-lg border bg-white pr-6 pl-8 text-right text-base outline-none sm:text-sm focus:ring-2 focus:ring-brand/20 ${
          state === 'error' ? 'border-red-400' : !allowEmpty && !text ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 focus:border-brand'
        }`}
      />
      {state === 'saved' && <Check className="absolute top-1/2 right-1.5 size-4 -translate-y-1/2 text-emerald-500" />}
      {state === 'saving' && <Loader2 className="absolute top-1/2 right-1.5 size-4 -translate-y-1/2 animate-spin text-muted" aria-label="Salvando" />}
    </div>
  )
}
