/** Mesma regra do Supabase Auth: 8+ caracteres, com letras e números. */
export function strongPassword(value: string): boolean {
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value)
}
