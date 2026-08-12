import { cn } from '@/shared/cn'

type AppLogoProps = {
  className?: string
  title?: string
}

/** Route path + edit pen mark — matches `public/favicon.svg`. */
export function AppLogo({ className, title = 'Route Tracer' }: AppLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      className={cn('size-5 shrink-0', className)}
    >
      {title ? <title>{title}</title> : null}
      <rect width="32" height="32" rx="8" fill="#0f172a" />
      <path
        d="M7 22c2.5-1.5 4-4 4-7s1.5-5.5 4-7"
        stroke="#38bdf8"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 8c2.5 1.5 4 4 4 7s1.5 5.5 4 7"
        stroke="#38bdf8"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="11" cy="15" r="1.6" fill="#38bdf8" />
      <circle cx="19" cy="15" r="1.6" fill="#38bdf8" />
      <path
        d="M20.5 21.5l5.2-5.2a1.2 1.2 0 0 1 1.7 1.7l-5.2 5.2-2.2.5.5-2.2z"
        fill="#f8fafc"
        stroke="#0f172a"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}
