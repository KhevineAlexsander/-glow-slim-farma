import { useCallback, useEffect, useRef, useState } from 'react'
import { formatBRL } from './money'
import { countNewOrders, fetchOrdersSince, latestOrderAt, type OrderAlert } from '../services/admin'

/**
 * Alertas de pedido novo no painel: consulta o banco a cada 15s (e ao voltar para a aba),
 * toca um aviso sonoro, mostra o card na tela, muda o título da aba e, com permissão,
 * envia a notificação do sistema quando o painel está em segundo plano.
 */

const POLL_MS = 15_000
const SOUND_KEY = 'glow:order-sound'

// ---- som (gerado no navegador, sem arquivo) --------------------------------
let audio: AudioContext | null = null

/** Os navegadores só liberam áudio depois de um toque/clique na página. */
function unlockAudio() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    audio = null
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlockAudio, { passive: true })
  window.addEventListener('keydown', unlockAudio)
}

/** Duas notas curtas e claras (sol-mi agudo), repetidas duas vezes. */
export function playOrderChime() {
  try {
    audio ??= new AudioContext()
    const ctx = audio
    if (ctx.state === 'suspended') void ctx.resume()
    const notes: [number, number][] = [
      [784, 0],
      [1319, 0.16],
      [784, 0.55],
      [1319, 0.71],
    ]
    for (const [freq, at] of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + at
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.4)
    }
  } catch {
    // sem áudio disponível: fica só o aviso visual
  }
}

function readSound(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

export function orderAlertText(o: OrderAlert): string {
  const value = o.total_cents > 0 ? formatBRL(o.total_cents) + (o.has_unpriced_items ? ' +' : '') : 'a cotar'
  return `${o.customer_name} · ${value}`
}

export function useOrderAlerts(enabled: boolean) {
  const [alerts, setAlerts] = useState<OrderAlert[]>([])
  const [newCount, setNewCount] = useState(0)
  const [sound, setSoundState] = useState(readSound)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )
  const since = useRef<string | null>(null)
  const soundRef = useRef(sound)
  useEffect(() => {
    soundRef.current = sound
  }, [sound])

  const setSound = useCallback((on: boolean) => {
    setSoundState(on)
    try {
      localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
    } catch {
      // preferência só nesta visita
    }
    if (on) {
      unlockAudio()
      playOrderChime() // prévia do som ao ligar
    }
  }, [])

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return
    setPermission(await Notification.requestPermission())
  }, [])

  const dismiss = useCallback((id: string) => setAlerts((list) => list.filter((a) => a.id !== id)), [])

  useEffect(() => {
    if (!enabled) return
    let stopped = false

    const check = async () => {
      try {
        if (since.current == null) since.current = await latestOrderAt()
        const fresh = await fetchOrdersSince(since.current)
        if (stopped) return
        setNewCount(await countNewOrders())
        if (!fresh.length) return
        since.current = fresh[fresh.length - 1].created_at
        setAlerts((list) => [...fresh.reverse(), ...list].slice(0, 4))
        if (soundRef.current) playOrderChime()
        // notificação do sistema quando o painel não está à vista
        if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          for (const o of fresh) {
            const n = new Notification(`Novo ${o.kind === 'order' ? 'pedido' : 'orçamento'} #${o.order_number}`, {
              body: orderAlertText(o),
              icon: '/icons/icon-192.png',
              tag: o.id,
            })
            n.onclick = () => {
              window.focus()
              window.location.href = `/admin/pedidos/${o.id}`
            }
          }
        }
      } catch {
        // falha de rede: tenta de novo na próxima rodada
      }
    }

    void check()
    const timer = window.setInterval(check, POLL_MS)
    const onVisible = () => !document.hidden && void check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled])

  return { alerts, dismiss, newCount, setNewCount, sound, setSound, permission, requestPermission }
}
