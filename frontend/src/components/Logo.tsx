interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
}

const HEIGHTS = {
  sm: 'h-7',
  md: 'h-9 sm:h-11',
  lg: 'h-12',
}

/** Bisheriges Bildlogo (public/logo.png). */
export default function Logo({ size = 'md' }: LogoProps) {
  return <img src="/logo.png" alt="Logo" className={`${HEIGHTS[size]} w-auto`} />
}
