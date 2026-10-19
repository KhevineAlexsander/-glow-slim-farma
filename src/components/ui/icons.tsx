import {
  Baby,
  Droplet,
  Dumbbell,
  FlaskConical,
  HeartPulse,
  Leaf,
  Package,
  PawPrint,
  Pill,
  Scale,
  Scissors,
  ShieldCheck,
  Smile,
  Sparkles,
  Stethoscope,
  Sun,
  Syringe,
  type LucideIcon,
} from 'lucide-react'

/** Ícones disponíveis para categorias (escolhidos no painel). */
export const CATEGORY_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  pill: { icon: Pill, label: 'Medicamento' },
  syringe: { icon: Syringe, label: 'Injetável' },
  sparkles: { icon: Sparkles, label: 'Estética' },
  leaf: { icon: Leaf, label: 'Natural' },
  droplet: { icon: Droplet, label: 'Dermocosmético' },
  flask: { icon: FlaskConical, label: 'Manipulado' },
  scale: { icon: Scale, label: 'Emagrecimento' },
  dumbbell: { icon: Dumbbell, label: 'Performance' },
  scissors: { icon: Scissors, label: 'Capilar' },
  smile: { icon: Smile, label: 'Facial' },
  heart: { icon: HeartPulse, label: 'Saúde' },
  sun: { icon: Sun, label: 'Proteção solar' },
  shield: { icon: ShieldCheck, label: 'Imunidade' },
  stethoscope: { icon: Stethoscope, label: 'Clínico' },
  baby: { icon: Baby, label: 'Infantil' },
  paw: { icon: PawPrint, label: 'Pet' },
  package: { icon: Package, label: 'Outros' },
}

export function CategoryIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = (name && CATEGORY_ICONS[name]?.icon) || Package
  return <Icon className={className} />
}
