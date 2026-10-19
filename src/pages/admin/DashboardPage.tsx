import { AlertCircle, CircleDollarSign, Eye, FileUp, Package, ShoppingBag, Tags } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AdminPageHeader } from '../../components/admin/AdminLayout'
import { ErrorBox, PageLoader } from '../../components/ui/misc'
import { friendlyError } from '../../lib/supabase'
import { fetchDashboardStats, type DashboardStats } from '../../services/admin'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardStats().then(setStats).catch((e) => setError(friendlyError(e)))
  }, [])

  if (error) return <ErrorBox message={error} />
  if (!stats) return <PageLoader />

  const cards = [
    { label: 'Produtos cadastrados', value: stats.products_total, icon: Package, to: '/admin/produtos' },
    { label: 'Produtos publicados', value: stats.products_published, icon: Eye, to: '/admin/produtos?status=published' },
    { label: 'Produtos sem preço', value: stats.products_no_price, icon: CircleDollarSign, to: '/admin/produtos?semPreco=1', warn: stats.products_no_price > 0 },
    { label: 'Aguardando revisão', value: stats.products_review, icon: AlertCircle, to: '/admin/produtos?revisar=1', warn: stats.products_review > 0 },
    { label: 'Categorias', value: stats.categories_total, icon: Tags, to: '/admin/categorias' },
    { label: 'Pedidos e orçamentos', value: stats.orders_total, icon: ShoppingBag, to: '/admin/pedidos', extra: stats.orders_new ? `${stats.orders_new} novo(s)` : undefined },
  ]

  return (
    <div>
      <AdminPageHeader title="Painel">
        <Link to="/admin/produtos/novo" className="btn-primary">Novo produto</Link>
        <Link to="/admin/importar" className="btn-outline"><FileUp className="size-4" /> Importar</Link>
      </AdminPageHeader>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="card flex min-w-0 flex-col gap-2 p-3 hover:ring-2 hover:ring-brand/20 sm:p-4">
            <c.icon className={`size-6 ${c.warn ? 'text-amber-500' : 'text-brand'}`} />
            <p className="text-3xl font-extrabold text-slate-900">{c.value}</p>
            <p className="text-sm text-slate-500">{c.label}</p>
            {c.extra && <p className="text-xs font-semibold text-brand">{c.extra}</p>}
          </Link>
        ))}
      </div>
      {stats.products_no_price > 0 && (
        <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Há {stats.products_no_price} produto(s) sem preço. Na loja eles aparecem como “sob consulta”. Defina os preços
          rapidamente na{' '}
          <Link to="/admin/produtos?semPreco=1" className="font-semibold underline">lista de produtos</Link>.
        </p>
      )}
    </div>
  )
}
