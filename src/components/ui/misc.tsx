import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`size-5 animate-spin text-brand ${className}`} aria-label="Carregando" />
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="size-8" />
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border border-dashed border-hairline px-6 py-10 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="bg-[#ffedea] px-4 py-3 text-sm text-[#831c1e]">
      {message}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  return (
    <label className={`flex min-h-11 items-center gap-3 py-1 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors before:absolute before:-inset-2.5 before:content-[''] ${
          checked ? 'bg-ink' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5.5' : 'translate-x-0.5'
          }`}
        />
      </button>
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
    </label>
  )
}

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number
  pageSize: number
  total: number
  onChange: (p: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  return (
    <div className="flex items-center justify-between gap-2 text-sm text-muted">
      <span className="tabular">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button className="btn-ghost px-3" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Anterior">
          <ChevronLeft className="size-4" />
        </button>
        <span className="px-2">
          {page}/{pages}
        </span>
        <button
          className="btn-ghost px-3"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          aria-label="Próxima"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-[#dcfae5] text-[#04250e]',
    amber: 'bg-[#fffbeb] text-[#92400e]',
    red: 'bg-[#ffedea] text-[#831c1e]',
    blue: 'bg-brand-light text-brand-dark',
  }
  return (
    <span className={`inline-flex flex-none items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  )
}
