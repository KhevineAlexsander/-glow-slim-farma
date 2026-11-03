import { Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatBRL } from '../../lib/money'
import { listProducts, type ProductRow } from '../../services/admin'

/** Busca de produto para incluir em um pedido. */
export function ProductPicker({ onAdd }: { onAdd: (p: ProductRow) => void | Promise<void> }) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<ProductRow[] | null>(null)

  useEffect(() => {
    const q = term.trim()
    if (q.length < 2) {
      setResults(null)
      return
    }
    const t = setTimeout(() => {
      listProducts({ search: q, status: 'active', page: 1, pageSize: 6 })
        .then((r) => setResults(r.rows))
        .catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(t)
  }, [term])

  return (
    <div className="mt-4 border-t border-hairline pt-4">
      <label className="relative block">
        <span className="sr-only">Buscar produto para incluir</span>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-body" aria-hidden="true" />
        <input className="input pl-10" placeholder="Incluir produto: busque pelo nome ou referência" value={term} onChange={(e) => setTerm(e.target.value)} />
      </label>
      {results && (
        <ul className="mt-2 divide-y divide-hairline rounded-xl border border-hairline">
          {results.length === 0 && <li className="p-3 text-sm text-body">Nenhum produto encontrado.</li>}
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm hover:bg-surface-soft"
                onClick={() => void Promise.resolve(onAdd(p)).then(() => setTerm(''))}
              >
                <span className="min-w-0 truncate text-ink">{p.name}</span>
                <span className="tabular flex shrink-0 items-center gap-2 text-body">
                  {p.price_cents > 0 ? formatBRL(p.promo_price_cents && p.promo_price_cents < p.price_cents ? p.promo_price_cents : p.price_cents) : 'sem preço'}
                  <Plus className="size-4 text-brand-dark" aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
