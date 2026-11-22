// Über den Import vergibt Vite beim Build einen Inhalts-Hash im Dateinamen
// (z. B. assets/logo-AbC123.png). Ein neues Logo bekommt so automatisch eine
// neue URL und hängt nicht in Browser- oder CDN-Caches fest.
// public/logo.png bleibt zusätzlich bestehen – die E-Mail-Templates verlinken
// es unter der festen URL {frontend_url}/logo.png.
import logoUrl from '../assets/logo.png'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
}

const HEIGHTS = {
  sm: 'h-7',
  md: 'h-9 sm:h-11',
  lg: 'h-12',
}

export default function Logo({ size = 'md' }: LogoProps) {
  return <img src={logoUrl} alt="Logo" className={`${HEIGHTS[size]} w-auto`} />
}
