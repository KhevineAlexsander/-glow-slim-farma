import { useParams } from 'react-router'
import { EmptyState } from '../../components/ui/misc'
import { useLoadedSettings } from '../../contexts/SettingsContext'

const POLICIES = {
  privacidade: { field: 'policy_privacy', title: 'Política de privacidade' },
  termos: { field: 'policy_terms', title: 'Termos de uso' },
  entrega: { field: 'policy_shipping', title: 'Entregas e trocas' },
} as const

export default function PolicyPage() {
  const { tipo = '' } = useParams()
  const s = useLoadedSettings()
  const policy = POLICIES[tipo as keyof typeof POLICIES]
  const content = policy ? s[policy.field] : null

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {policy && content ? (
        <>
          <h1 className="text-2xl font-extrabold text-brand-dark">{policy.title}</h1>
          <div className="mt-6 text-sm leading-relaxed whitespace-pre-line text-slate-700">{content}</div>
        </>
      ) : (
        <EmptyState title="Página não encontrada." />
      )}
    </div>
  )
}
