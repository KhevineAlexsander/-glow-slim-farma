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
    <div className="mx-auto max-w-3xl px-(--margin) py-12">
      {policy && content ? (
        <>
          <h1 className="text-2xl font-semibold text-ink">{policy.title}</h1>
          <div className="mt-6 text-sm leading-relaxed whitespace-pre-line text-ink">{content}</div>
        </>
      ) : (
        <EmptyState title="Página não encontrada." />
      )}
    </div>
  )
}
