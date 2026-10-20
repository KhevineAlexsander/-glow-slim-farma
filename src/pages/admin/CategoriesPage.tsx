import { Eye, EyeOff, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { AdminPageHeader } from '../../components/admin/AdminLayout'
import { ImageInput } from '../../components/admin/ImageInput'
import { CATEGORY_ICONS, CategoryIcon } from '../../components/ui/icons'
import { EmptyState, ErrorBox, PageLoader, Toggle } from '../../components/ui/misc'
import { useToast } from '../../components/ui/Toast'
import { categoryColors } from '../../components/store/VialArt'
import { buildCategoryTree } from '../../lib/categoryTree'
import { slugify } from '../../lib/slug'
import { friendlyError } from '../../lib/supabase'
import { countProductsByCategory, deleteCategory, listAllCategories, saveCategory } from '../../services/admin'
import type { Category } from '../../types'

type Draft = Partial<Category> & { name: string; slug: string }

function CategoryForm({
  initial,
  all,
  onClose,
  onSaved,
}: {
  initial: Draft
  all: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  // Grupos possíveis: categorias sem grupo (exceto ela mesma). Quem já tem subcategorias é grupo e não entra em outro.
  const groupOptions = all.filter((g) => !g.parent_id && g.id !== initial.id)
  const isGroupWithChildren = Boolean(initial.id && all.some((x) => x.parent_id === initial.id))
  const [c, setC] = useState<Draft>(initial)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const name = c.name.trim()
    if (!name) return setError('Informe o nome.')
    setSaving(true)
    try {
      await saveCategory({
        id: c.id,
        name,
        slug: slugify(c.slug || name),
        description: c.description || null,
        icon: c.icon || null,
        image_url: c.image_url || null,
        sort_order: Math.trunc(Number(c.sort_order) || 0),
        is_visible: c.is_visible ?? true,
        parent_id: c.parent_id || null,
      })
      onSaved()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="max-h-[92dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{c.id ? 'Editar categoria' : 'Nova categoria'}</h2>
          <button type="button" className="btn-ghost size-11 px-0" onClick={onClose} aria-label="Fechar"><X className="size-5" /></button>
        </div>
        <div>
          <label className="label" htmlFor="cname">Nome *</label>
          <input id="cname" className="input" maxLength={80} required value={c.name} onChange={(e) => setC({ ...c, name: e.target.value, slug: c.id ? c.slug : slugify(e.target.value) })} />
        </div>
        <div>
          <label className="label" htmlFor="cgroup">Grupo</label>
          <select
            id="cgroup"
            className="input"
            value={c.parent_id ?? ''}
            disabled={isGroupWithChildren}
            onChange={(e) => setC({ ...c, parent_id: e.target.value || null })}
          >
            <option value="">Nenhum (esta categoria é um grupo)</option>
            {groupOptions.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {isGroupWithChildren
              ? 'Esta categoria é um grupo com subcategorias.'
              : 'A loja mostra só os grupos; as subcategorias aparecem como filtro dentro do grupo.'}
          </p>
        </div>
        <div>
          <label className="label" htmlFor="cdesc">Descrição</label>
          <input id="cdesc" className="input" maxLength={500} value={c.description ?? ''} onChange={(e) => setC({ ...c, description: e.target.value })} />
        </div>
        <div>
          <span className="label">Ícone</span>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
            {Object.entries(CATEGORY_ICONS).map(([key, { label }]) => (
              <button
                key={key}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => setC({ ...c, icon: key })}
                className={`flex size-11 items-center justify-center rounded-lg border ${c.icon === key ? 'border-ink bg-surface-strong text-ink' : 'border-hairline text-slate-500'}`}
              >
                <CategoryIcon name={key} className="size-5" />
              </button>
            ))}
          </div>
        </div>
        <ImageInput label="Imagem (opcional, substitui o ícone)" folder="categories" value={c.image_url ?? null} onChange={(url) => setC({ ...c, image_url: url })} />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="corder">Ordem</label>
            <input id="corder" type="number" className="input" value={c.sort_order ?? 0} onChange={(e) => setC({ ...c, sort_order: Number(e.target.value) })} />
          </div>
          <div className="flex items-end pb-2">
            <Toggle checked={c.is_visible ?? true} onChange={(v) => setC({ ...c, is_visible: v })} label="Visível na loja" />
          </div>
        </div>
        {error && <ErrorBox message={error} />}
        <button className="btn-primary w-full" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
      </form>
    </div>
  )
}

export default function CategoriesPage() {
  const toast = useToast()
  const [list, setList] = useState<Category[] | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [editing, setEditing] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    listAllCategories().then(setList).catch((e) => setError(friendlyError(e)))
    countProductsByCategory().then(setCounts).catch(() => {})
  }
  useEffect(() => {
    load()
  }, [])

  const toggle = async (c: Category) => {
    try {
      await saveCategory({ ...c, is_visible: !c.is_visible })
      load()
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  const remove = async (c: Category) => {
    const n = counts[c.id] ?? 0
    const msg = n
      ? `A categoria "${c.name}" tem ${n} produto(s). Eles ficarão sem categoria. Excluir mesmo assim?`
      : `Excluir a categoria "${c.name}"?`
    if (!confirm(msg)) return
    try {
      await deleteCategory(c.id)
      toast('Categoria excluída.')
      load()
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  if (error) return <ErrorBox message={error} />
  if (!list) return <PageLoader />

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader title="Categorias">
        <button className="btn-primary" onClick={() => setEditing({ name: '', slug: '', sort_order: (list.at(-1)?.sort_order ?? 0) + 1, is_visible: true })}>
          <Plus className="size-4" /> Nova categoria
        </button>
      </AdminPageHeader>
      {list.length === 0 ? (
        <EmptyState title="Nenhuma categoria cadastrada.">As categorias também são criadas automaticamente na importação de produtos.</EmptyState>
      ) : (
        <div className="space-y-2">
          {buildCategoryTree(list).flatMap(({ group, children }) => [group, ...children]).map((c) => (
            <div
              key={c.id}
              className={`card flex items-center gap-3 p-3 ${c.parent_id ? 'ml-6 sm:ml-10' : ''} ${c.is_visible ? '' : 'opacity-60'}`}
            >
              {c.image_url ? (
                <img src={c.image_url} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
              ) : (
                // a bolinha é a cor dos frascos do grupo na loja
                <span className="flex size-10 shrink-0 items-center justify-center" aria-hidden="true">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: (categoryColors(c.slug, list) ?? ['#94a3b8'])[0] }} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{c.name}</p>
                <p className="text-xs text-slate-500">
                  {c.parent_id ? 'Subcategoria' : list.some((x) => x.parent_id === c.id) ? 'Grupo' : 'Categoria'} · Ordem{' '}
                  {c.sort_order} · {counts[c.id] ?? 0} produto(s) {c.is_visible ? '' : '· oculta'}
                </p>
              </div>
              <button className="btn-ghost size-11 px-0" onClick={() => void toggle(c)} aria-label={c.is_visible ? 'Ocultar' : 'Publicar'} title={c.is_visible ? 'Ocultar' : 'Publicar'}>
                {c.is_visible ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
              </button>
              <button className="btn-ghost size-11 px-0" onClick={() => setEditing(c)} aria-label="Editar"><Pencil className="size-5" /></button>
              <button className="btn-ghost size-11 px-0 text-red-600" onClick={() => void remove(c)} aria-label="Excluir"><Trash2 className="size-5" /></button>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <CategoryForm
          initial={editing}
          all={list}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            toast('Categoria salva.')
            load()
          }}
        />
      )}
    </div>
  )
}
