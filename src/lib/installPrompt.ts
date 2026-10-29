import { useSyncExternalStore } from 'react'

/**
 * Instalação do app (PWA).
 * - Android/Chrome/Edge: o navegador dispara "beforeinstallprompt"; guardamos o evento
 *   e o botão "Instalar" abre a janela nativa de instalação.
 * - iPhone/iPad (Safari): não existe esse evento; o botão mostra o passo a passo
 *   (Compartilhar → Adicionar à Tela de Início).
 * O evento pode chegar antes da página montar, por isso a escuta começa ao carregar este módulo.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type InstallState = { canPrompt: boolean; installed: boolean }

let deferred: BeforeInstallPromptEvent | null = null
let state: InstallState = { canPrompt: false, installed: false }
const listeners = new Set<() => void>()

function setState(next: Partial<InstallState>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** iPhone/iPad no Safari (no iPadOS o Safari se apresenta como Mac com tela de toque). */
export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  // Navegadores dentro de outros apps (Instagram, Facebook, Chrome do iOS) não instalam
  const inApp = /crios|fxios|edgios|instagram|fban|fbav|line\//i.test(ua)
  return ios && !inApp
}

if (typeof window !== 'undefined') {
  state.installed = isStandalone()
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    setState({ canPrompt: true })
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    setState({ canPrompt: false, installed: true })
  })
}

/** Abre a janela nativa de instalação. Retorna true se a pessoa aceitou. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const ev = deferred
  deferred = null
  setState({ canPrompt: false })
  await ev.prompt()
  const { outcome } = await ev.userChoice
  if (outcome === 'accepted') setState({ installed: true })
  return outcome === 'accepted'
}

export function useInstallPrompt() {
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
    () => state,
  )
  const ios = isIosSafari()
  return {
    ...snap,
    /** Mostrar a opção de instalar: há instalação nativa ou é Safari do iPhone; e ainda não está instalado. */
    available: !snap.installed && (snap.canPrompt || ios),
    ios: ios && !snap.canPrompt,
  }
}
