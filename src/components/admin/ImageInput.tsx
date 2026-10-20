import { ImagePlus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { friendlyError } from '../../lib/supabase'
import { uploadImage } from '../../services/admin'
import { useToast } from '../ui/Toast'

/** Campo de imagem única (logo, banner, categoria): envia ao storage e devolve a URL. */
export function ImageInput({
  value,
  onChange,
  folder,
  label,
  hint,
}: {
  value: string | null
  onChange: (url: string | null) => void
  folder: string
  label: string
  hint?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const { url } = await uploadImage(file, folder)
      onChange(url)
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setBusy(false)
      if (ref.current) ref.current.value = ''
    }
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {value ? <img src={value} alt="" className="size-full object-contain" /> : <ImagePlus className="size-6 text-slate-300" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline" disabled={busy} onClick={() => ref.current?.click()}>
            {busy ? 'Enviando…' : value ? 'Trocar' : 'Enviar imagem'}
          </button>
          {value && (
            <button type="button" className="btn-ghost text-red-600" onClick={() => onChange(null)}>
              <Trash2 className="size-4" /> Remover
            </button>
          )}
        </div>
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    </div>
  )
}
