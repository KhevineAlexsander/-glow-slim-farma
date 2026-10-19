// Todo valor monetário trafega como CENTAVOS inteiros. Nada de float em cálculos.

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatBRL(cents: number): string {
  return brl.format(cents / 100)
}

/** Formata centavos para edição: 12345 -> "123,45". */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return ''
  const negative = cents < 0
  const abs = Math.abs(Math.trunc(cents))
  const reais = Math.floor(abs / 100).toString()
  const centavos = (abs % 100).toString().padStart(2, '0')
  return `${negative ? '-' : ''}${reais},${centavos}`
}

/**
 * Converte texto digitado em centavos, sem usar ponto flutuante.
 * Aceita "1.234,56", "1234,5", "1234", "R$ 99,90", "12.50" (ponto decimal).
 * Retorna null se o texto for inválido.
 */
export function parseBRLToCents(input: string): number | null {
  let s = input.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '')
  if (s === '') return null
  if (!/^\d[\d.,]*$/.test(s)) return null

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let intPart: string
  let fracPart = ''

  if (lastComma >= 0) {
    // Vírgula é o separador decimal; pontos são milhar.
    intPart = s.slice(0, lastComma).replace(/\./g, '')
    fracPart = s.slice(lastComma + 1)
    if (fracPart.includes('.')) return null
  } else if (lastDot >= 0 && s.length - lastDot - 1 <= 2 && s.indexOf('.') === lastDot) {
    // Um único ponto seguido de 1–2 dígitos: tratar como decimal ("12.50").
    intPart = s.slice(0, lastDot)
    fracPart = s.slice(lastDot + 1)
  } else {
    // Apenas pontos de milhar ("1.234").
    s = s.replace(/\./g, '')
    intPart = s
  }

  if (!/^\d+$/.test(intPart || '0') || !/^\d{0,2}$/.test(fracPart)) return null
  const cents = Number(intPart || '0') * 100 + Number(fracPart.padEnd(2, '0') || '0')
  if (!Number.isSafeInteger(cents)) return null
  return cents
}

export const MAX_PRICE_CENTS = 100_000_000
