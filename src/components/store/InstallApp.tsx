import { Download, PlusSquare, Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { promptInstall, useInstallPrompt } from '../../lib/installPrompt'
import { BrandMark } from './Logo'

const DISMISS_KEY = 'glow:install-dismissed'
const DISMISS_DAYS = 14

function dismissedRecently(): boolean {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0)
    return Date.now() - t < DISMISS_DAYS * 86_400_000
  } catch {
    return false
  }
}

/** Passo a passo do iPhone/iPad (o Safari não tem botão de instalar). */
function IosSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="ios-titulo">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl">
        <button onClick={onClose} className="btn-ghost absolute top-3 right-3 size-11 px-0" aria-label="Fechar">
          <X className="size-5" />
        </button>
        <BrandMark className="size-12" />
        <h2 id="ios-titulo" className="mt-4 text-lg font-semibold text-ink">
          Instalar o app no iPhone
        </h2>
        <ol className="mt-4 space-y-4 text-base text-ink">
          <li className="flex items-start gap-3">
            <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-strong text-sm font-semibold">1</span>
            <span>
              Toque em <strong>Compartilhar</strong>{' '}
              <Share className="inline size-5 -translate-y-0.5 text-brand-dark" aria-label="(ícone de compartilhar)" /> na barra do Safari.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-strong text-sm font-semibold">2</span>
            <span>
              Escolha <strong>Adicionar à Tela de Início</strong>{' '}
              <PlusSquare className="inline size-5 -translate-y-0.5 text-brand-dark" aria-hidden="true" />.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-strong text-sm font-semibold">3</span>
            <span>
              Toque em <strong>Adicionar</strong>. O ícone da Glow Slim aparece na tela do celular.
            </span>
          </li>
        </ol>
        <button onClick={onClose} className="btn-primary mt-6 w-full">
          Entendi
        </button>
      </div>
    </div>,
    document.body,
  )
}

/** Botão "Instalar o app": janela nativa (Android) ou passo a passo (iPhone). Some quando já está instalado. */
export function InstallButton({ className = 'btn-primary', label = 'Instalar o app', icon = true }: { className?: string; label?: string; icon?: boolean }) {
  const { available, ios } = useInstallPrompt()
  const [sheet, setSheet] = useState(false)
  if (!available) return null
  return (
    <>
      <button type="button" className={className} onClick={() => (ios ? setSheet(true) : void promptInstall())}>
        {icon && <Download className="size-4 shrink-0" aria-hidden="true" />} {label}
      </button>
      {sheet && <IosSheet onClose={() => setSheet(false)} />}
    </>
  )
}

/** Faixa no celular, logo abaixo do cabeçalho: convida a instalar; pode ser fechada por 14 dias. */
export function InstallBar() {
  const { available } = useInstallPrompt()
  const [hidden, setHidden] = useState(dismissedRecently)
  if (!available || hidden) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // sem armazenamento: só esconde nesta visita
    }
    setHidden(true)
  }

  return (
    <div className="border-b border-hairline bg-surface-soft md:hidden">
      <div className="wrap flex items-center gap-3 py-2.5">
        <BrandMark className="size-9" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-ink">Instale o app da loja</p>
          <p className="truncate text-xs text-body">Acesso pela tela inicial</p>
        </div>
        <InstallButton className="btn-primary min-h-10 shrink-0 px-4 text-sm" label="Instalar" icon={false} />
        <button type="button" onClick={dismiss} className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-full text-body hover:bg-surface-strong" aria-label="Agora não">
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
