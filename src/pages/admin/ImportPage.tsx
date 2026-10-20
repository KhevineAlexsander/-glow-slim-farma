import { AlertTriangle, CheckCircle2, Download, FileUp, XCircle } from 'lucide-react'
import Papa from 'papaparse'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { AdminPageHeader } from '../../components/admin/AdminLayout'
import { Badge, ErrorBox, Spinner } from '../../components/ui/misc'
import { CSV_TEMPLATE_HEADERS, parseProductsCsv, type ImportRow, type ParsedImport } from '../../lib/csvImport'
import { slugify, uniqueSlug } from '../../lib/slug'
import { friendlyError, supabase } from '../../lib/supabase'
import { fetchExistingProductKeys, listAllCategories, saveCategory } from '../../services/admin'

type DuplicateMode = 'skip' | 'update'

interface Result {
  created: number
  updated: number
  skipped: number
  failed: { line: number; message: string }[]
  categoriesCreated: number
}

function downloadTemplate() {
  const example = [
    'Exemplo de produto',
    'REF-001',
    'Laboratório X',
    'Categoria Exemplo',
    'Resumo curto',
    'Descrição completa',
    'Composição do produto',
    'Frasco 10 ml',
    'Oral',
    'não',
    'não',
    'sim',
    'Conferir dados com o fornecedor',
    'Catálogo 2026',
    '1',
    '',
  ]
  const csv = Papa.unparse({ fields: CSV_TEMPLATE_HEADERS, data: [example] }, { delimiter: ';' })
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'modelo-importacao-produtos.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}

function rowStatus(r: ImportRow): { label: string; tone: 'green' | 'amber' | 'red' | 'blue' } {
  if (r.errors.length) return { label: 'Erro', tone: 'red' }
  if (r.duplicateOf) return { label: `Já existe (${r.duplicateOf.by})`, tone: 'blue' }
  if (r.warnings.length || r.data.needs_review) return { label: 'Novo — revisar', tone: 'amber' }
  return { label: 'Novo', tone: 'green' }
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedImport | null>(null)
  const [mode, setMode] = useState<DuplicateMode>('skip')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setResult(null)
    setParsed(null)
    if (file.size > 5 * 1024 * 1024) return setError('Arquivo muito grande (máximo 5 MB).')
    setBusy(true)
    try {
      const textContent = await file.text()
      const existing = await fetchExistingProductKeys()
      const p = parseProductsCsv(textContent, existing)
      if (p.fatal) setError(p.fatal)
      else setParsed(p)
      setFileName(file.name)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const rows = parsed?.rows ?? []
  const valid = rows.filter((r) => !r.errors.length)
  const toCreate = valid.filter((r) => !r.duplicateOf)
  const duplicates = valid.filter((r) => r.duplicateOf)
  const withErrors = rows.filter((r) => r.errors.length)

  const runImport = async () => {
    if (!parsed) return
    const total = toCreate.length + (mode === 'update' ? duplicates.length : 0)
    if (!confirm(`Importar ${total} produto(s)? Todos entram OCULTOS e com preço R$ 0,00 para revisão.`)) return
    setBusy(true)
    setError(null)
    const res: Result = { created: 0, updated: 0, skipped: 0, failed: [], categoriesCreated: 0 }

    try {
      // 1) Categorias: reaproveita as existentes (pelo nome/slug) e cria as que faltam.
      setProgress('Preparando categorias…')
      const cats = await listAllCategories()
      const catBySlug = new Map(cats.map((c) => [c.slug, c.id]))
      let nextOrder = cats.reduce((m, c) => Math.max(m, c.sort_order), 0) + 1
      for (const name of new Set(valid.map((r) => r.data.category).filter((c): c is string => Boolean(c)))) {
        const slug = slugify(name)
        if (!slug || catBySlug.has(slug)) continue
        const created = await saveCategory({ name, slug, sort_order: nextOrder++, is_visible: true })
        catBySlug.set(slug, created.id)
        res.categoriesCreated++
      }
      const categoryId = (name: string | null) => (name ? (catBySlug.get(slugify(name)) ?? null) : null)

      // 2) Produtos novos — sempre ocultos e com preço zero (o banco também garante o preço zero).
      const existing = await fetchExistingProductKeys()
      const takenSlugs = new Set(existing.map((e) => e.slug))
      const descriptive = (r: ImportRow) => ({
        name: r.data.name,
        sku: r.data.sku,
        brand: r.data.brand,
        category_id: categoryId(r.data.category),
        short_description: r.data.short_description,
        description: r.data.description,
        composition: r.data.composition,
        presentation: r.data.presentation,
        usage_route: r.data.usage_route,
        requires_prescription: r.data.requires_prescription,
        restricted_sale: r.data.restricted_sale,
        needs_review: r.data.needs_review || r.warnings.length > 0,
        review_notes: [r.data.review_notes, ...r.warnings.map((w) => `• ${w}`)].filter(Boolean).join('\n') || null,
        source_catalog: r.data.source_catalog,
        source_page: r.data.source_page,
      })

      const BATCH = 50
      for (let i = 0; i < toCreate.length; i += BATCH) {
        setProgress(`Criando produtos ${i + 1}–${Math.min(i + BATCH, toCreate.length)} de ${toCreate.length}…`)
        const batch = toCreate.slice(i, i + BATCH)
        const payload = batch.map((r) => {
          const slug = uniqueSlug(r.data.name, takenSlugs)
          takenSlugs.add(slug)
          return { ...descriptive(r), slug, status: 'draft' as const, price_cents: 0, promo_price_cents: null }
        })
        const { data, error } = await supabase.from('products').insert(payload).select('id, slug')
        if (error) {
          // Se o lote falhar, tenta item a item para identificar a linha com problema.
          for (let j = 0; j < payload.length; j++) {
            const single = await supabase.from('products').insert(payload[j]).select('id, slug').single()
            if (single.error) res.failed.push({ line: batch[j].line, message: friendlyError(single.error) })
            else {
              res.created++
              await attachImage(single.data.id, batch[j])
            }
          }
        } else {
          res.created += data.length
          const bySlug = new Map(data.map((d) => [d.slug, d.id]))
          for (let j = 0; j < batch.length; j++) {
            const id = bySlug.get(payload[j].slug)
            if (id) await attachImage(id, batch[j])
          }
        }
      }

      // 3) Duplicados: ignora ou atualiza apenas dados descritivos (nunca preço nem publicação).
      if (mode === 'update') {
        for (const [k, r] of duplicates.entries()) {
          setProgress(`Atualizando existentes ${k + 1} de ${duplicates.length}…`)
          const { error } = await supabase.from('products').update(descriptive(r)).eq('id', r.duplicateOf!.id)
          if (error) res.failed.push({ line: r.line, message: friendlyError(error) })
          else res.updated++
        }
      } else {
        res.skipped = duplicates.length
      }
      setResult(res)
      setParsed(null)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  async function attachImage(productId: string, r: ImportRow) {
    if (!r.data.image_url) return
    await supabase.from('product_images').insert({ product_id: productId, url: r.data.image_url, sort_order: 0 })
  }

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader title="Importar produtos" />

      <div className="card space-y-3 p-4 text-sm text-slate-600 sm:p-5">
        <p>
          Importe uma planilha <strong>CSV</strong> (Excel/Google Planilhas → “Salvar como CSV”). Antes de gravar, você vê
          uma pré-visualização com erros e duplicados.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Todo produto importado entra <strong>oculto</strong> e com <strong>preço R$ 0,00</strong>. Colunas de preço são ignoradas.</li>
          <li>Duplicados são detectados pela <strong>referência</strong> (ou pelo nome, quando não há referência).</li>
          <li>Categorias que não existem são criadas automaticamente.</li>
          <li>Linhas com avisos ficam marcadas como “Revisar” na lista de produtos.</li>
          <li>
            Catálogos em PDF: os PDFs fornecidos já foram convertidos em CSV (pasta <code>importacao/</code> do projeto).
            Para novos PDFs, preencha o modelo abaixo.
          </li>
        </ul>
        <div className="flex flex-wrap gap-2 pt-1">
          <button className="btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
            <FileUp className="size-4" /> Escolher arquivo CSV
          </button>
          <button className="btn-outline" onClick={downloadTemplate}>
            <Download className="size-4" /> Baixar modelo
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>

      {busy && (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
          <Spinner /> {progress || 'Lendo arquivo…'}
        </div>
      )}
      {error && <div className="mt-4"><ErrorBox message={error} /></div>}

      {result && (
        <div className="card mt-4 space-y-2 p-5">
          <p className="flex items-center gap-2 font-bold text-emerald-700"><CheckCircle2 className="size-5" /> Importação concluída</p>
          <ul className="text-sm text-slate-700">
            <li>{result.created} produto(s) criado(s) — ocultos e sem preço</li>
            {result.updated > 0 && <li>{result.updated} produto(s) existente(s) atualizado(s)</li>}
            {result.skipped > 0 && <li>{result.skipped} duplicado(s) ignorado(s)</li>}
            {result.categoriesCreated > 0 && <li>{result.categoriesCreated} categoria(s) criada(s)</li>}
          </ul>
          {result.failed.length > 0 && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {result.failed.map((f) => (
                <p key={f.line}>Linha {f.line}: {f.message}</p>
              ))}
            </div>
          )}
          <Link to="/admin/produtos?status=draft" className="btn-primary">Revisar produtos importados</Link>
        </div>
      )}

      {parsed && (
        <div className="mt-4 space-y-4">
          <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
            <span className="font-semibold">{fileName}</span>
            <span className="text-emerald-700">{toCreate.length} novo(s)</span>
            <span className="text-brand">{duplicates.length} já existente(s)</span>
            <span className="text-red-600">{withErrors.length} com erro (não serão importados)</span>
            {rows.some((r) => !r.data.sku) && (
              <span className="text-slate-500">
                {rows.filter((r) => !r.data.sku).length} sem referência (duplicidade verificada pelo nome)
              </span>
            )}
            {parsed.ignoredColumns.length > 0 && (
              <span className="text-slate-500">Colunas ignoradas: {parsed.ignoredColumns.join(', ')}</span>
            )}
          </div>

          {duplicates.length > 0 && (
            <div className="card space-y-2 p-4 text-sm">
              <p className="font-semibold">O que fazer com produtos que já existem?</p>
              <label className="flex min-h-11 items-center gap-2">
                <input type="radio" className="size-5 accent-[var(--brand)]" checked={mode === 'skip'} onChange={() => setMode('skip')} />
                Ignorar (não alterar nada)
              </label>
              <label className="flex min-h-11 items-center gap-2">
                <input type="radio" className="size-5 accent-[var(--brand)]" checked={mode === 'update'} onChange={() => setMode('update')} />
                Atualizar dados descritivos (preço e publicação nunca são alterados)
              </label>
            </div>
          )}

          {/* Celular: cards empilhados */}
          <div className="space-y-2 md:hidden">
            {rows.map((r) => {
              const st = rowStatus(r)
              return (
                <div key={r.line} className="card space-y-1 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">Linha {r.line}</span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <p className="font-medium">
                    {r.data.name || <span className="text-slate-500">—</span>}
                    {(r.data.requires_prescription || r.data.restricted_sale) && (
                      <span className="ml-1 text-xs font-semibold text-amber-700">(restrito)</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {[r.data.sku && `Ref. ${r.data.sku}`, r.data.category ?? 'Sem categoria'].filter(Boolean).join(' · ')}
                  </p>
                  {r.errors.map((e) => (
                    <p key={e} className="flex gap-1 text-xs text-red-600"><XCircle className="mt-0.5 size-3 shrink-0" />{e}</p>
                  ))}
                  {r.warnings.map((w) => (
                    <p key={w} className="flex gap-1 text-xs text-amber-700"><AlertTriangle className="mt-0.5 size-3 shrink-0" />{w}</p>
                  ))}
                  {r.data.review_notes && <p className="text-xs text-slate-500">{r.data.review_notes}</p>}
                </div>
              )
            })}
          </div>

          {/* Tablet e desktop: tabela */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2">Linha</th>
                  <th className="px-3 py-2">Situação</th>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Ref.</th>
                  <th className="px-3 py-2">Categoria</th>
                  <th className="px-3 py-2">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const st = rowStatus(r)
                  return (
                    <tr key={r.line} className="align-top">
                      <td className="px-3 py-2 text-slate-500">{r.line}</td>
                      <td className="px-3 py-2"><Badge tone={st.tone}>{st.label}</Badge></td>
                      <td className="px-3 py-2 font-medium">
                        {r.data.name || <span className="text-slate-500">—</span>}
                        {(r.data.requires_prescription || r.data.restricted_sale) && (
                          <span className="ml-1 text-xs font-semibold text-amber-700">(restrito)</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{r.data.sku ?? '—'}</td>
                      <td className="px-3 py-2">{r.data.category ?? '—'}</td>
                      <td className="max-w-xs px-3 py-2 text-xs">
                        {r.errors.map((e) => (
                          <p key={e} className="flex gap-1 text-red-600"><XCircle className="mt-0.5 size-3 shrink-0" />{e}</p>
                        ))}
                        {r.warnings.map((w) => (
                          <p key={w} className="flex gap-1 text-amber-700"><AlertTriangle className="mt-0.5 size-3 shrink-0" />{w}</p>
                        ))}
                        {r.data.review_notes && <p className="text-slate-500">{r.data.review_notes}</p>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="btn-primary"
              disabled={busy || (toCreate.length === 0 && (mode === 'skip' || duplicates.length === 0))}
              onClick={() => void runImport()}
            >
              Confirmar importação
            </button>
            <button className="btn-ghost" onClick={() => setParsed(null)} disabled={busy}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
