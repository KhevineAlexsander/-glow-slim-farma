import { useRouteError } from 'react-router'

/** Exibida quando uma página falha inesperadamente (no lugar da tela técnica do React Router). */
export default function RouteError() {
  const error = useRouteError()
  if (import.meta.env.DEV) console.error(error)
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-xl font-extrabold text-brand-dark">Algo deu errado.</p>
      <p className="mt-2 text-slate-600">Tente recarregar a página. Se o problema continuar, fale com a loja.</p>
      <div className="mt-6 flex justify-center gap-2">
        <button className="btn-primary" onClick={() => window.location.reload()}>
          Recarregar
        </button>
        <a href="/" className="btn-outline">
          Ir para o início
        </a>
      </div>
    </div>
  )
}
