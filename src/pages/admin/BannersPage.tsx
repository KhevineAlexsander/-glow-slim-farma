import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { AdminPageHeader } from '../../components/admin/AdminLayout'
import { ImageInput } from '../../components/admin/ImageInput'
import { Badge, EmptyState, ErrorBox, PageLoader, Toggle } from '../../components/ui/misc'
import { useToast } from '../../components/ui/Toast'
import { friendlyError } from '../../lib/supabase'
import { deleteBanner, listAllBanners, saveBanner } from '../../services/admin'
import type { Banner } from '../../types'

type Draft = Partial<Banner> & { title: string }

function BannerForm({ initial, onClose, onSaved }: { initial: Draft; onClose: () => void; onSaved: () => void }) {
  const [b, setB] = useState<Draft>(initial)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!b.title.trim()) return setError('Informe o título.')
    const link = b.button_link?.trim() || null
    if (link && !link.startsWith('/') && !/^https?:\/\//i.test(link)) {
      return setError('O link deve começar com / (página da loja) ou https://')
    }
    setSaving(true)
    try {
      await saveBanner({
        id: b.id,
        placement: b.placement ?? 'hero',
        eyebrow: b.eyebrow?.trim() || null,
        title: b.title.trim(),
        subtitle: b.subtitle?.trim() || null,
        button_label: b.button_label?.trim() || null,
        button_link: link,
        image_url: b.image_url || null,
        sort_order: Math.trunc(Number(b.sort_order) || 0),
        is_active: b.is_active ?? true,
      })
      onSaved()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  const field = (key: 'eyebrow' | 'title' | 'subtitle' | 'button_label' | 'button_link') => ({
    value: (b[key] as string | null) ?? '',
    onChange: (e: { target: { value: string } }) => setB({ ...b, [key]: e.target.value }),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="max-h-[92dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{b.id ? 'Editar banner' : 'Novo banner'}</h2>
          <button type="button" className="btn-ghost size-11 px-0" onClick={onClose} aria-label="Fechar"><X className="size-5" /></button>
        </div>
        <div>
          <label className="label" htmlFor="bplace">Posição</label>
          <select id="bplace" className="input" value={b.placement ?? 'hero'} onChange={(e) => setB({ ...b, placement: e.target.value as Banner['placement'] })}>
            <option value="hero">Banner principal (topo)</option>
            <option value="secondary">Banner secundário (entre as seções)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="beyebrow">Chamada pequena</label>
          <input id="beyebrow" className="input" maxLength={80} placeholder="Ex.: Sua saúde e bem-estar" {...field('eyebrow')} />
        </div>
        <div>
          <label className="label" htmlFor="btitle">Título *</label>
          <input id="btitle" className="input" maxLength={120} required {...field('title')} />
        </div>
        <div>
          <label className="label" htmlFor="bsub">Texto</label>
          <textarea id="bsub" className="input min-h-20 py-2" maxLength={300} {...field('subtitle')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="blabel">Texto do botão</label>
            <input id="blabel" className="input" maxLength={40} placeholder="Ver ofertas" {...field('button_label')} />
          </div>
          <div>
            <label className="label" htmlFor="blink">Link do botão</label>
            <input id="blink" className="input" maxLength={500} placeholder="/produtos?ofertas=1" {...field('button_link')} />
          </div>
        </div>
        <ImageInput label="Imagem" folder="banners" value={b.image_url ?? null} onChange={(url) => setB({ ...b, image_url: url })} hint="PNG com fundo transparente fica melhor sobre o fundo azul." />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="border">Ordem</label>
            <input id="border" type="number" className="input" value={b.sort_order ?? 0} onChange={(e) => setB({ ...b, sort_order: Number(e.target.value) })} />
          </div>
          <div className="flex items-end pb-2">
            <Toggle checked={b.is_active ?? true} onChange={(v) => setB({ ...b, is_active: v })} label="Ativo" />
          </div>
        </div>
        {error && <ErrorBox message={error} />}
        <button className="btn-primary w-full" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
      </form>
    </div>
  )
}

export default function BannersPage() {
  const toast = useToast()
  const [list, setList] = useState<Banner[] | null>(null)
  const [editing, setEditing] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => listAllBanners().then(setList).catch((e) => setError(friendlyError(e)))
  useEffect(() => void load(), [])

  const remove = async (b: Banner) => {
    if (!confirm(`Excluir o banner "${b.title}"?`)) return
    try {
      await deleteBanner(b.id)
      toast('Banner excluído.')
      void load()
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  if (error) return <ErrorBox message={error} />
  if (!list) return <PageLoader />

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader title="Banners">
        <button className="btn-primary" onClick={() => setEditing({ title: '', placement: 'hero', is_active: true, sort_order: list.length })}>
          <Plus className="size-4" /> Novo banner
        </button>
      </AdminPageHeader>
      {list.length === 0 ? (
        <EmptyState title="Nenhum banner cadastrado." />
      ) : (
        <div className="space-y-2">
          {list.map((b) => (
            <div key={b.id} className={`card flex items-center gap-3 p-3 ${b.is_active ? '' : 'opacity-60'}`}>
              <div className="bg-brand-gradient flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                {b.image_url && <img src={b.image_url} alt="" className="h-full w-full object-contain" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{b.title}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge tone="blue">{b.placement === 'hero' ? 'Principal' : 'Secundário'}</Badge>
                  {!b.is_active && <Badge>Inativo</Badge>}
                </div>
              </div>
              <button className="btn-ghost size-11 px-0" onClick={() => setEditing(b)} aria-label="Editar"><Pencil className="size-5" /></button>
              <button className="btn-ghost size-11 px-0 text-red-600" onClick={() => void remove(b)} aria-label="Excluir"><Trash2 className="size-5" /></button>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <BannerForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            toast('Banner salvo.')
            void load()
          }}
        />
      )}
    </div>
  )
}
