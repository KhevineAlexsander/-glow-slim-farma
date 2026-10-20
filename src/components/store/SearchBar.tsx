import { Search } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

export function SearchBar({ className = '' }: { className?: string }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [term, setTerm] = useState(params.get('q') ?? '')

  useEffect(() => {
    setTerm(params.get('q') ?? '')
  }, [params])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = term.trim()
    navigate(q ? `/produtos?q=${encodeURIComponent(q)}` : '/produtos')
  }

  return (
    <form onSubmit={submit} role="search" className={`relative ${className}`}>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-body" aria-hidden="true" />
      <input
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Buscar produtos, marcas ou referências…"
        aria-label="Buscar produtos"
        className="h-11 w-full rounded-full border border-transparent bg-surface-strong pr-5 pl-11 text-base text-ink outline-none placeholder:text-[#5b616e] focus:border-brand-dark focus:bg-white sm:text-sm"
      />
    </form>
  )
}
