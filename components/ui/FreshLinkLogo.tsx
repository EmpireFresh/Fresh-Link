"use client"

interface Props {
  size?: number
  variant?: "icon-only" | "full" | "full-white" | "company-only" | "stacked"
  className?: string
  showAppName?: boolean
}

export const BRAND = {
  company: "Empire Fresh",
  companyTag: "Fruit & Vegetable Distribution Network — Morocco",
  app: "Fresh Link Pro",
  tagline: "Gestion & Distribution Intelligente",
  primaryGreen: "#1a4f2a",
  accentGold: "#b8962e",
  logoPath: "/empire-fresh-logo.png",
}

function EFIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: 10, flexShrink: 0 }}
    >
      <rect width="48" height="48" rx="10" fill="#1a4f2a" />
      <text x="24" y="34" textAnchor="middle" fontSize="26" fontWeight="900" fontFamily="Arial, sans-serif" fill="#b8962e">EF</text>
      <path d="M8 38 Q24 42 40 38" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
    </svg>
  )
}

export default function FreshLinkLogo({ size = 40, variant = "full", className = "", showAppName = true }: Props) {
  const logoSize = variant === "icon-only" ? size : Math.round(size * 1.1)

  const Logo = <EFIcon size={logoSize} />

  if (variant === "icon-only") {
    return <span className={`inline-block ${className}`}>{Logo}</span>
  }

  if (variant === "stacked") {
    return (
      <div className={`flex flex-col items-center gap-1.5 ${className}`}>
        <EFIcon size={size} />
        <div className="text-center leading-none">
          <div className="font-black tracking-tight" style={{ fontSize: size * 0.28, color: BRAND.primaryGreen }}>
            {BRAND.company}
          </div>
          <div className="font-semibold tracking-wide" style={{ fontSize: size * 0.13, color: BRAND.accentGold }}>
            {BRAND.companyTag}
          </div>
        </div>
      </div>
    )
  }

  if (variant === "company-only") {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        {Logo}
        <div className="flex flex-col leading-none gap-0.5">
          <span className="font-black tracking-tight" style={{ fontSize: Math.round(size * 0.4), color: BRAND.primaryGreen, letterSpacing: "-0.01em" }}>
            {BRAND.company}
          </span>
          <span className="font-medium tracking-wide uppercase" style={{ fontSize: Math.round(size * 0.18), color: BRAND.accentGold }}>
            {BRAND.companyTag}
          </span>
        </div>
      </div>
    )
  }

  const isWhite = variant === "full-white"

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {Logo}
      <div className="flex flex-col leading-none gap-1">
        {showAppName && (
          <span
            className="font-extrabold tracking-tight"
            style={{ fontSize: Math.round(size * 0.38), color: isWhite ? "#ffffff" : BRAND.primaryGreen, letterSpacing: "-0.01em", lineHeight: 1.1 }}
          >
            Fresh{" "}
            <span style={{ color: isWhite ? "#86efac" : BRAND.accentGold }}>Link</span>{" "}
            <span style={{ color: isWhite ? "#4ade80" : BRAND.primaryGreen }}>Pro</span>
          </span>
        )}
        <span
          className="font-bold tracking-wide"
          style={{ fontSize: Math.round(size * 0.2), color: isWhite ? "rgba(255,255,255,0.65)" : BRAND.accentGold, letterSpacing: "0.04em", lineHeight: 1.2, textTransform: "uppercase" }}
        >
          {BRAND.company}
        </span>
      </div>
    </div>
  )
}
