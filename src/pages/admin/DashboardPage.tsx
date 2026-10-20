import { FileUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AdminPageHeader } from '../../components/admin/AdminLayout'
import { Badge, ErrorBox, PageLoader } from '../../components/ui/misc'
import { formatBRL } from '../../lib/money'
import { formatDateTime, ORDER_STATUS } from '../../lib/orderStatus'
import { friendlyError } from '../../lib/supabase'
import { fetchDashboardStats, listOrders, type DashboardStats } from '../../services/admin'
import type { Order } from '../../types'

const RECENT = 5
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Visão geral do painel. Pergunta da tela: "Há pedidos esperando resposta, e o
 * catálogo está pronto para vender?". Pedidos novos é o número que responde; a
 * prontidão de preços (a maior parte do catálogo é "sob consulta") é o elemento
 * próprio deste produto.
 */
export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recent, setRecent] = useState<{ rows: Order[]; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ordersError, setOrdersError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardStats().then(setStats).catch((e) => setError(friendlyError(e)))
    listOrders({ page: 1, pageSize: RECENT })
      .then(setRecent)
      .catch((e) => setOrdersError(friendlyError(e)))
  }, [])

  if (error) return <ErrorBox message={error} />
  if (!stats) return <PageLoader />

  const priced = stats.products_total - stats.products_no_price
  const pricedPct = stats.products_total > 0 ? (priced / stats.products_total) * 100 : 0
  const finding = [
    stats.orders_new > 0 ? `${plural(stats.orders_new, 'pedido novo', 'pedidos novos')} esperando resposta` : 'Nenhum pedido novo',
    stats.products_no_price > 0 ? `${plural(stats.products_no_price, 'produto', 'produtos')} sem preço aparecem como “sob consulta”` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const kpis = [
    { label: 'Pedidos novos', value: stats.orders_new, to: '/admin/pedidos?status=new', lead: true },
    { label: 'Pedidos e orçamentos', value: stats.orders_total, to: '/admin/pedidos' },
    { label: 'Produtos publicados', value: stats.products_published, suffix: ` /${stats.products_total}`, to: '/admin/produtos?status=published' },
    { label: 'Aguardando revisão', value: stats.products_review, to: '/admin/produtos?revisar=1' },
    { label: 'Categorias', value: stats.categories_total, to: '/admin/categorias' },
  ]

  return (
    <div>
      <AdminPageHeader title="Painel" subtitle={finding}>
        <Link to="/admin/importar" className="btn-outline">
          <FileUp className="size-4" aria-hidden="true" /> Importar
        </Link>
        <Link to="/admin/produtos/novo" className="btn-primary">
          Novo produto
        </Link>
      </AdminPageHeader>

      {/* Um contêiner dividido por linhas finas; o último ocupa a linha inteira no celular (contagem ímpar) */}
      <div className="card grid grid-cols-2 overflow-hidden sm:grid-cols-5">
        {kpis.map((k, i) => (
          <Link
            key={k.label}
            to={k.to}
            className={`flex flex-col gap-1 border-[#e8e8e8] p-4 hover:bg-[#f9fafb] sm:border-l sm:first:border-l-0 ${
              i > 1 ? 'border-t sm:border-t-0' : ''
            } ${i % 2 === 1 ? 'border-l' : ''} ${i === kpis.length - 1 ? 'col-span-2 sm:col-span-1' : ''}`}
          >
            <span className="text-sm text-muted">{k.label}</span>
            <span className={`tabular text-ink ${k.lead ? 'text-[32px] leading-10 font-semibold' : 'text-2xl leading-10'}`}>
              {k.value}
              {k.suffix && <span className="text-sm text-muted">{k.suffix}</span>}
            </span>
          </Link>
        ))}
      </div>

      {/* Os dois cards dividem a linha e terminam juntos; no pé do de pedidos fica só o total e o link */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card flex flex-col p-5" aria-labelledby="ultimos-pedidos">
          <h2 id="ultimos-pedidos" className="text-base font-medium text-ink">
            Últimos pedidos
          </h2>
          {ordersError ? (
            <div className="mt-3">
              <ErrorBox message={ordersError} />
            </div>
          ) : recent === null ? (
            <ul className="mt-3" aria-hidden="true">
              {Array.from({ length: 3 }, (_, i) => (
                <li key={i} className="flex h-14 items-center border-t border-[#f2f2f2]">
                  <span className="h-4 w-1/2 bg-[#f1f5f9]" />
                </li>
              ))}
            </ul>
          ) : recent.rows.length === 0 ? (
            <p className="mt-3 border border-dashed border-[#d1d5db] px-4 py-3 text-sm text-muted">
              Nenhum pedido ainda. Quando um cliente finalizar pelo WhatsApp, o pedido aparece aqui.
            </p>
          ) : (
            <ul className="mt-3">
              {recent.rows.map((o) => (
                <li key={o.id} className="border-t border-[#f2f2f2]">
                  <Link to={`/admin/pedidos/${o.id}`} className="flex min-h-14 items-center gap-3 py-2 hover:bg-[#f9fafb]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        <span className="tabular">#{o.order_number}</span> · {o.customer_name}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        {formatDateTime(o.created_at)} · {o.kind === 'order' ? 'Pedido' : 'Orçamento'}
                        <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                      </span>
                    </span>
                    <span className="tabular w-24 shrink-0 text-right text-sm text-ink">
                      {o.total_cents > 0 ? formatBRL(o.total_cents) : <span className="text-muted">A cotar</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-auto flex items-baseline justify-between gap-3 border-t border-[#f2f2f2] pt-4 text-sm text-muted">
            <span className="tabular">{recent ? plural(recent.total, 'pedido ou orçamento', 'pedidos e orçamentos') : ' '}</span>
            <Link to="/admin/pedidos" className="text-ink underline">
              Ver todos
            </Link>
          </p>
        </section>

        <section className="card p-5" aria-labelledby="precos">
          <h2 id="precos" className="text-base font-medium text-ink">
            Preços do catálogo
          </h2>
          <p className="mt-3 flex items-baseline justify-between gap-3 text-sm text-muted">
            <span>Com preço definido</span>
            <span className="tabular">
              <span className="text-2xl text-ink">{priced}</span> /{stats.products_total}
            </span>
          </p>
          {/* barra na proporção real; sem toco quando é zero */}
          <div className="mt-2 h-2 w-full rounded-full bg-[#eef1f5]" role="img" aria-label={`${priced} de ${stats.products_total} produtos com preço`}>
            {priced > 0 && <div className="h-2 rounded-full bg-brand-dark" style={{ width: `${pricedPct}%` }} />}
          </div>
          <ul className="mt-4">
            <li className="flex min-h-14 items-center justify-between gap-3 border-t border-[#f2f2f2] text-sm">
              <span className="text-ink">
                Sem preço <span className="text-muted">· aparecem como “sob consulta”</span>
              </span>
              <span className="flex shrink-0 items-center gap-4">
                <span className="tabular text-ink">{stats.products_no_price}</span>
                {stats.products_no_price > 0 && (
                  <Link to="/admin/produtos?semPreco=1" className="text-ink underline">
                    Definir preços
                  </Link>
                )}
              </span>
            </li>
            <li className="flex min-h-14 items-center justify-between gap-3 border-t border-[#f2f2f2] text-sm">
              <span className="text-ink">Aguardando revisão</span>
              <span className="flex shrink-0 items-center gap-4">
                <span className="tabular text-ink">{stats.products_review}</span>
                {stats.products_review > 0 && (
                  <Link to="/admin/produtos?revisar=1" className="text-ink underline">
                    Revisar
                  </Link>
                )}
              </span>
            </li>
            <li className="flex min-h-14 items-center justify-between gap-3 border-t border-[#f2f2f2] text-sm">
              <span className="text-ink">Rascunhos e ocultos</span>
              <span className="tabular text-ink">{stats.products_total - stats.products_published}</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}
