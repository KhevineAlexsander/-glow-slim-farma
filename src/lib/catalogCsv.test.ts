import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseProductsCsv } from './csvImport'

// Garante que os CSVs gerados a partir dos catálogos PDF continuam importáveis.
describe.each(['catalogo-mr-vitaminas.csv', 'tabela-esthetike-shop.csv'])('%s', (file) => {
  const parsed = parseProductsCsv(readFileSync(`importacao/${file}`, 'utf-8'), [])

  it('não tem erros nem colunas desconhecidas', () => {
    expect(parsed.fatal).toBeNull()
    expect(parsed.ignoredColumns).toEqual([])
    expect(parsed.rows.filter((r) => r.errors.length).map((r) => [r.line, r.errors])).toEqual([])
  })

  it('todo item tem nome, categoria e origem', () => {
    for (const r of parsed.rows) {
      expect(r.data.category).toBeTruthy()
      expect(r.data.source_catalog).toBeTruthy()
      expect(r.data.source_page).toBeGreaterThan(0)
    }
  })
})
