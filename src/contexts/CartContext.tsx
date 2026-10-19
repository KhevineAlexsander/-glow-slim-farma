import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * O carrinho guarda apenas IDs e quantidades no navegador.
 * Nomes e preços são sempre relidos do banco; o valor final é calculado
 * pela função place_order no servidor.
 */
export interface CartLine {
  productId: string
  quantity: number
}

interface CartState {
  lines: CartLine[]
  count: number
  add: (productId: string, quantity?: number) => void
  setQuantity: (productId: string, quantity: number) => void
  remove: (productId: string) => void
  clear: () => void
}

const KEY = 'gsf-cart-v1'
const CartContext = createContext<CartState | null>(null)

function load(): CartLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    if (!Array.isArray(raw)) return []
    return raw
      .filter((l): l is CartLine => typeof l?.productId === 'string' && Number.isInteger(l?.quantity))
      .map((l) => ({ productId: l.productId, quantity: Math.min(Math.max(l.quantity, 1), 999) }))
      .slice(0, 50)
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines))
    } catch {
      // armazenamento indisponível (modo privado): o carrinho segue em memória
    }
  }, [lines])

  const add = (productId: string, quantity = 1) =>
    setLines((prev) => {
      const found = prev.find((l) => l.productId === productId)
      if (found) {
        return prev.map((l) =>
          l.productId === productId ? { ...l, quantity: Math.min(l.quantity + quantity, 999) } : l,
        )
      }
      if (prev.length >= 50) return prev
      return [...prev, { productId, quantity: Math.min(Math.max(quantity, 1), 999) }]
    })

  const setQuantity = (productId: string, quantity: number) =>
    setLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, quantity: Math.min(Math.max(quantity, 1), 999) } : l)),
    )

  const remove = (productId: string) => setLines((prev) => prev.filter((l) => l.productId !== productId))
  const clear = () => setLines([])
  const count = lines.reduce((sum, l) => sum + l.quantity, 0)

  return (
    <CartContext.Provider value={{ lines, count, add, setQuantity, remove, clear }}>{children}</CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart fora do CartProvider')
  return ctx
}
