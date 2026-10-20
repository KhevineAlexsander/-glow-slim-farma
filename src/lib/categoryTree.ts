import type { Category } from '../types'

export interface CategoryGroup {
  group: Category
  children: Category[]
}

/**
 * Agrupa as categorias em um nível: categorias sem grupo são os grupos (podendo
 * não ter subcategorias); as demais ficam dentro do seu grupo. Mantém a ordem.
 */
export function buildCategoryTree(categories: Category[]): CategoryGroup[] {
  const byParent = new Map<string, Category[]>()
  for (const c of categories) {
    if (c.parent_id) byParent.set(c.parent_id, [...(byParent.get(c.parent_id) ?? []), c])
  }
  const ids = new Set(categories.map((c) => c.id))
  return categories
    // subcategoria cujo grupo não veio na lista (oculto) aparece como grupo próprio
    .filter((c) => !c.parent_id || !ids.has(c.parent_id))
    .map((group) => ({ group, children: byParent.get(group.id) ?? [] }))
}

/** Slugs a filtrar: um grupo inclui as suas subcategorias. */
export function slugsForCategory(slug: string, categories: Category[]): string[] {
  const cat = categories.find((c) => c.slug === slug)
  if (!cat) return [slug]
  const children = categories.filter((c) => c.parent_id === cat.id).map((c) => c.slug)
  return [cat.slug, ...children]
}

/** O grupo de uma categoria (ela mesma, se for um grupo). */
export function groupOf(slug: string, categories: Category[]): Category | undefined {
  const cat = categories.find((c) => c.slug === slug)
  if (!cat) return undefined
  return cat.parent_id ? (categories.find((c) => c.id === cat.parent_id) ?? cat) : cat
}
