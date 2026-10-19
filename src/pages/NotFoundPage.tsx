import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-5xl font-extrabold text-brand">404</p>
      <p className="mt-2 text-slate-600">Página não encontrada.</p>
      <Link to="/" className="btn-primary mt-6">
        Ir para o início
      </Link>
    </div>
  )
}
