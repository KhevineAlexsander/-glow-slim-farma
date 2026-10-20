import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { friendlyError } from '../../lib/supabase'
import {
  addProductImage,
  deleteProductImage,
  listProductImages,
  reorderProductImages,
  uploadImage,
} from '../../services/admin'
import type { ProductImage } from '../../types'
import { Spinner } from '../ui/misc'
import { useToast } from '../ui/Toast'

/** Galeria de imagens do produto. A primeira imagem é a principal. */
export function ProductImages({ productId }: { productId: string }) {
  const [images, setImages] = useState<ProductImage[] | null>(null)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const reload = () => listProductImages(productId).then(setImages).catch((e) => toast(friendlyError(e), 'error'))

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  const upload = async (files: FileList | null) => {
    if (!files?.length || !images) return
    setBusy(true)
    let order = images.length
    for (const file of Array.from(files).slice(0, 10)) {
      try {
        const stored = await uploadImage(file, `products/${productId}`)
        await addProductImage(productId, stored, order++)
      } catch (e) {
        toast(`${file.name}: ${friendlyError(e)}`, 'error')
      }
    }
    await reload()
    setBusy(false)
    if (ref.current) ref.current.value = ''
  }

  const remove = async (img: ProductImage) => {
    if (!confirm('Remover esta imagem?')) return
    try {
      await deleteProductImage(img)
      await reload()
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  const move = async (index: number, dir: -1 | 1) => {
    if (!images) return
    const next = [...images]
    const [item] = next.splice(index, 1)
    next.splice(index + dir, 0, item)
    setImages(next)
    await reorderProductImages(next)
  }

  if (!images) return <Spinner />

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {images.map((img, i) => (
          <div key={img.id} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white">
            <img src={img.url} alt="" className="aspect-square w-full object-contain" />
            {i === 0 && <span className="absolute top-1 left-1 rounded bg-brand px-1.5 text-[10px] font-bold text-white">Principal</span>}
            <div className="flex justify-between border-t border-slate-100 bg-white">
              <button type="button" className="flex h-11 flex-1 items-center justify-center text-slate-500 disabled:opacity-30" disabled={i === 0} onClick={() => void move(i, -1)} aria-label="Mover para a esquerda">
                <ArrowLeft className="size-4" />
              </button>
              <button type="button" className="flex h-11 flex-1 items-center justify-center text-red-500" onClick={() => void remove(img)} aria-label="Remover imagem">
                <Trash2 className="size-4" />
              </button>
              <button type="button" className="flex h-11 flex-1 items-center justify-center text-slate-500 disabled:opacity-30" disabled={i === images.length - 1} onClick={() => void move(i, 1)} aria-label="Mover para a direita">
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-200 text-sm text-slate-500 hover:border-brand hover:text-brand"
        >
          {busy ? <Spinner /> : <ImagePlus className="size-6" />}
          {busy ? 'Enviando…' : 'Adicionar'}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">JPG, PNG ou WEBP, até 5 MB cada. Prefira imagens quadradas com fundo claro.</p>
      <input ref={ref} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => void upload(e.target.files)} />
    </div>
  )
}
