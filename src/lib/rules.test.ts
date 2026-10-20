import { describe, expect, it } from 'vitest'
import { parseProductsCsv } from './csvImport'
import { centsToInput, formatBRL, parseBRLToCents } from './money'
import { effectivePriceCents, productDisplay, type PricingSettings } from './pricing'
import { strongPassword } from './password'
import { slugify, uniqueSlug } from './slug'
import { orderMessage, whatsappLink } from './whatsapp'

const base = {
  price_cents: 0,
  promo_price_cents: null,
  is_available: true,
  requires_prescription: false,
  restricted_sale: false,
}
const orderMode: PricingSettings = { sales_mode: 'order', no_price_label: 'consult', whatsapp_number: '5511999999999' }
const quoteMode: PricingSettings = { ...orderMode, sales_mode: 'quote' }

describe('money', () => {
  it('converte texto em centavos sem float', () => {
    expect(parseBRLToCents('1.234,56')).toBe(123456)
    expect(parseBRLToCents('R$ 99,90')).toBe(9990)
    expect(parseBRLToCents('0,1')).toBe(10)
    expect(parseBRLToCents('12.50')).toBe(1250)
    expect(parseBRLToCents('1.234')).toBe(123400)
    expect(parseBRLToCents('951,88')).toBe(95188)
    expect(parseBRLToCents('0,29')).toBe(29) // 0.29 * 100 em float daria 28.999...
    expect(parseBRLToCents('')).toBeNull()
    expect(parseBRLToCents('abc')).toBeNull()
    expect(parseBRLToCents('-5')).toBeNull()
    expect(parseBRLToCents('1,234')).toBeNull()
  })
  it('formata centavos', () => {
    expect(formatBRL(95188).replace(/\s/g, ' ')).toBe('R$ 951,88')
    expect(centsToInput(5)).toBe('0,05')
    expect(centsToInput(123456)).toBe('1234,56')
  })
})

describe('pricing', () => {
  it('preço zero nunca aparece como grátis', () => {
    const d = productDisplay(base, orderMode)
    expect(d.price).toBeNull()
    expect(d.priceNote).toBe('Preço sob consulta')
    expect(d.action).toBe('whatsapp')
    expect(productDisplay(base, { ...orderMode, no_price_label: 'whatsapp' }).priceNote).toBe('Consulte pelo WhatsApp')
  })
  it('sem preço e sem WhatsApp não gera botão quebrado', () => {
    expect(productDisplay(base, { ...orderMode, whatsapp_number: null }).action).toBe('none')
  })
  it('produto com preço entra no carrinho no modo pedido', () => {
    const d = productDisplay({ ...base, price_cents: 10000 }, orderMode)
    expect(d.action).toBe('add_to_cart')
    expect(d.price).toContain('100,00')
  })
  it('promoção válida', () => {
    const p = { ...base, price_cents: 10000, promo_price_cents: 8000 }
    expect(effectivePriceCents(p)).toBe(8000)
    const d = productDisplay(p, orderMode)
    expect(d.discountPercent).toBe(20)
    expect(d.oldPrice).toContain('100,00')
    // promoção maior que o preço é ignorada
    expect(effectivePriceCents({ price_cents: 1000, promo_price_cents: 2000 })).toBe(1000)
  })
  it('prescrição: sem preço exibido e fora do checkout normal', () => {
    const d = productDisplay({ ...base, price_cents: 10000, requires_prescription: true }, orderMode)
    expect(d.price).toBeNull()
    expect(d.restricted).toBe(true)
    expect(d.action).toBe('whatsapp')
  })
  it('modo orçamento aceita qualquer produto disponível', () => {
    expect(productDisplay(base, quoteMode).action).toBe('add_to_quote')
    expect(productDisplay({ ...base, is_available: false }, quoteMode).action).toBe('unavailable')
  })
})

describe('senha', () => {
  it('exige 8+ caracteres com letras e números', () => {
    expect(strongPassword('vanessa@147')).toBe(true)
    expect(strongPassword('Aa88176895')).toBe(true)
    expect(strongPassword('12345678')).toBe(false)
    expect(strongPassword('abcdefgh')).toBe(false)
    expect(strongPassword('abc123')).toBe(false)
  })
})

describe('slug', () => {
  it('remove acentos e símbolos', () => {
    expect(slugify('Ácido Hialurônico 1% + DMAE')).toBe('acido-hialuronico-1-dmae')
    expect(uniqueSlug('Botox', new Set(['botox', 'botox-2']))).toBe('botox-3')
  })
})

describe('whatsapp', () => {
  it('monta link e mensagem com valores do banco', () => {
    expect(whatsappLink('+55 (11) 99999-9999', 'Oi')).toBe('https://wa.me/5511999999999?text=Oi')
    // cliente digita só DDD + número: o 55 é acrescentado
    expect(whatsappLink('(99) 98888-7777')).toBe('https://wa.me/5599988887777')
    expect(whatsappLink('9932221111')).toBe('https://wa.me/559932221111')
    const msg = orderMessage(
      'Glow',
      {
        order_number: 1001,
        kind: 'quote',
        total_cents: 2000,
        has_unpriced_items: true,
        requires_document_review: true,
        items: [
          { name: 'A', sku: 'X1', quantity: 2, unit_price_cents: 1000, requires_prescription: false },
          { name: 'B', sku: null, quantity: 1, unit_price_cents: null, requires_prescription: true },
        ],
      },
      'Ana',
    )
    expect(msg).toContain('nº 1001')
    expect(msg).toContain('2x A [X1]')
    expect(msg).toContain('preço a consultar')
    expect(msg).toContain('Subtotal')
  })
})

describe('csv import', () => {
  it('valida, ignora preço e detecta duplicados', () => {
    const csv = [
      'Nome;Referência;Categoria;Preço;Requer_Prescricao',
      'Produto A;A1;Cat;10,00;sim',
      'Produto B;;Cat;;não',
      'Produto A2;A1;Cat;;',
      ';;;;',
      'X;;;;talvez',
    ].join('\n')
    const r = parseProductsCsv(csv, [{ id: 'e1', sku: null, slug: 'produto-b' }])
    expect(r.fatal).toBeNull()
    expect(r.ignoredColumns).toContain('preco')
    const [a, b, a2, x] = r.rows
    expect(a.data.requires_prescription).toBe(true)
    expect(a.warnings[0]).toMatch(/preço ignorada/)
    expect(b.duplicateOf).toEqual({ id: 'e1', by: 'nome' })
    expect(a2.duplicateInFile).toBe(true)
    expect(x.errors.length).toBe(2) // nome curto + booleano inválido
    expect(r.rows.length).toBe(4)
  })
  it('exige coluna nome', () => {
    expect(parseProductsCsv('a,b\n1,2', []).fatal).toMatch(/nome/)
  })
})
