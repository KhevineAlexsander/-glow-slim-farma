import { buildCategoryTree } from '../../lib/categoryTree'
import type { Category } from '../../types'

/** <option>s de categoria agrupadas por grupo (para usar dentro de um <select>). */
export function CategoryOptions({ categories }: { categories: Category[] }) {
  return (
    <>
      {buildCategoryTree(categories).map(({ group, children }) =>
        children.length ? (
          <optgroup key={group.id} label={group.name}>
            <option value={group.id}>{group.name} (geral)</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </optgroup>
        ) : (
          <option key={group.id} value={group.id}>{group.name}</option>
        ),
      )}
    </>
  )
}
