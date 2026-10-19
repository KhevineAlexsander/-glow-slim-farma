import { Link } from 'react-router'
import { useLoadedSettings } from '../../contexts/SettingsContext'

export function Logo({ className = 'h-11' }: { className?: string }) {
  const s = useLoadedSettings()
  return (
    <Link to="/" className="flex shrink-0 items-center" aria-label={`${s.store_name} — página inicial`}>
      <img src={s.logo_url || '/logo.svg'} alt={s.store_name} className={`${className} w-auto object-contain`} />
    </Link>
  )
}
