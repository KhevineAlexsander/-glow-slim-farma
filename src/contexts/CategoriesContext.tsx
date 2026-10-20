import { createContext, useContext } from 'react'
import type { Category } from '../types'

/** Categorias públicas da loja (carregadas uma vez no StoreLayout). */
export const CategoriesContext = createContext<Category[]>([])

export function useCategories(): Category[] {
  return useContext(CategoriesContext)
}
