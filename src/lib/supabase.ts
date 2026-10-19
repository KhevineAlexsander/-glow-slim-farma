import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

// Somente a chave pública (anon). A segurança real é feita pela RLS no banco.
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true },
})

export const STORAGE_BUCKET = 'store-images'

/** Converte erros do Supabase/PostgREST em mensagens legíveis em português. */
export function friendlyError(error: unknown): string {
  if (!error) return 'Erro desconhecido.'
  const e = error as { message?: string; code?: string; details?: string }
  switch (e.code) {
    case '23505':
      return 'Já existe um registro com esse identificador (código/slug duplicado).'
    case '23503':
      return 'Este registro está vinculado a outros dados (por exemplo, pedidos) e não pode ser excluído. Arquive-o em vez de excluir.'
    case '23514':
      if (e.message?.includes('products_restricted_needs_review'))
        return 'Produtos com prescrição ou venda restrita só podem ser publicados após a revisão do responsável técnico.'
      if (e.message?.includes('products_promo_lt_price'))
        return 'O preço promocional precisa ser menor que o preço normal.'
      return 'Algum valor informado é inválido. Revise os campos.'
    case '42501':
      return 'Você não tem permissão para esta ação.'
    case 'PGRST301':
    case 'PGRST303':
      return 'Sua sessão expirou. Entre novamente.'
  }
  return e.message || 'Não foi possível concluir a operação.'
}
