import { useEffect, useRef, type ElementType, type ReactNode } from 'react'

/**
 * Entrada ao rolar (uma vez): sobe 24px com opacidade. O estado escondido só existe
 * com html.js e prefers-reduced-motion: no-preference (ver index.css), então o
 * conteúdo nunca some se o script falhar.
 */
export function Reveal({
  as: Tag = 'div',
  i = 0,
  className = '',
  children,
  ...rest
}: {
  as?: ElementType
  /** Ordem dentro da seção: atraso de 80ms por passo. */
  i?: number
  className?: string
  children: ReactNode
  [key: string]: unknown
}) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-in')
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Tag ref={ref} data-reveal="" style={{ '--i': i } as React.CSSProperties} className={className} {...rest}>
      {children}
    </Tag>
  )
}
