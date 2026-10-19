/** "Ácido Hialurônico 1%" -> "acido-hialuronico-1" */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
    .replace(/-+$/g, '')
}

/** Gera um slug que não esteja em `taken`, acrescentando -2, -3... */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const root = slugify(base) || 'item'
  if (!taken.has(root)) return root
  for (let i = 2; ; i++) {
    const candidate = `${root}-${i}`
    if (!taken.has(candidate)) return candidate
  }
}
