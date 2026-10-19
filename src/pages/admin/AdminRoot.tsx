import { RequireAdmin } from '../../components/admin/AdminLayout'

/** Ponto de entrada do painel (carregado sob demanda). */
export default function AdminRoot() {
  return <RequireAdmin />
}
