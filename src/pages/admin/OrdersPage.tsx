import { Search, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AdminPageHeader } from '../../components/admin/AdminLayout'
import { Badge, EmptyState, ErrorBox, Pagination, Spinner } from '../../components/ui/misc'
import { formatBRL } from '../../lib/money'
import { friendlyError } from '../../lib/supabase'
import { listOrders } from '../../services/admin'
import type { Order, OrderStatus } from '../../types'

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: 'blue' | 'amber' | 'green' | 'slate' | 'red' }> = {
  new: { label: 'Novo', tone: 'blue' },
  in_review: { label: 'Em atendimento', tone: 'amber' },
  confirmed: { label: 'Confirmado', tone: 'green' },
  completed: { label: 'Concluído', tone: 'slate' },
  cancelled: { label: 'Cancelado', tone: 'red' },
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const PAGE_SIZE = 20

export default function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? '') as OrderStatus | ''
  const page = Number(params.get('p') ?? '1') || 1
  const search = params.get('q') ?? ''
  const [searchText, setSearchText] = useState(search)
  const [data, setData] = useState<{ rows: Order[]; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'p') next.delete('p')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchText.trim() !== search) setParam('q', searchText.trim())
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText])

  useEffect(() => {
    setData(null)
    listOrders({ status, search, page, pageSize: PAGE_SIZE })
      .then(setData)
      .catch((e) => setError(friendlyError(e)))
  }, [status, search, page])

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader title="Pedidos e orçamentos" />
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Nome, telefone ou nº do pedido" value={searchText} onChange={(e) => setSearchText(e.target.value)} aria-label="Buscar pedidos" />
        </div>
        <select className="input" value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Status">
          <option value="">Todos os status</option>
          {Object.entries(ORDER_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {error && <ErrorBox message={error} />}
      {!data && !error && <div className="flex justify-center py-10"><Spinner className="size-8" /></div>}
      {data && data.rows.length === 0 && <EmptyState title="Nenhum pedido encontrado." />}
      {data && data.rows.length > 0 && (
        <>
          <div className="space-y-2">
            {data.rows.map((o) => (
              <Link key={o.id} to={`/admin/pedidos/${o.id}`} className="card flex flex-col gap-2 p-4 hover:ring-2 hover:ring-brand/20 sm:flex-row sm:items-center sm:gap-3">
                <div className="min-w-0 sm:flex-1">
                  <p className="font-bold text-slate-900">
                    #{o.order_number} · {o.customer_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(o.created_at)} · {o.kind === 'order' ? 'Pedido' : 'Orçamento'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {o.requires_document_review && (
                    <Badge tone={o.documents_verified ? 'green' : 'red'}>
                      <ShieldAlert className="mr-0.5 size-3" />
                      {o.documents_verified ? 'Docs ok' : 'Verificar docs'}
                    </Badge>
                  )}
                  <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                  <span className="ml-auto text-sm font-bold whitespace-nowrap text-brand-dark sm:ml-0">
                    {o.total_cents > 0 ? formatBRL(o.total_cents) : 'A cotar'}
                    {o.total_cents > 0 && o.has_unpriced_items ? ' +' : ''}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-4">
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={(p) => setParam('p', String(p))} />
          </div>
        </>
      )}
    </div>
  )
}
