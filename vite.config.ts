/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/**
 * Impede publicar um site quebrado ou inseguro: no build de produção exige as
 * variáveis do Supabase e recusa chaves secretas (service_role / sb_secret_).
 */
function checkSupabaseEnv(mode: string) {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (Vercel: Settings > Environment Variables).',
    )
  }
  if (!/^https?:\/\//.test(url)) throw new Error('VITE_SUPABASE_URL deve começar com https://')
  let role: string | undefined
  try {
    role = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString()).role
  } catch {
    role = undefined // chave no formato novo (sb_publishable_...)
  }
  if (key.startsWith('sb_secret_') || role === 'service_role') {
    throw new Error('VITE_SUPABASE_ANON_KEY contém a chave SECRETA. Use a chave pública anon/publishable.')
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode === 'production') checkSupabaseEnv(mode)
  return {
    plugins: [react(), tailwindcss()],
    test: {
      include: ['src/**/*.test.ts'],
    },
  }
})
