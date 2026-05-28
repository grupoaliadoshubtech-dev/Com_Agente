// components/icons.tsx
// SVG icon components — mesmo estilo do sidebar (stroke, no fill, strokeWidth=2)
// Uso: <IcoBan size={16} /> ou <IcoUsers size={32} />

interface P { size?: number; style?: React.CSSProperties; className?: string }

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export function IcoBuilding({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <path d="M6 22V12a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10"/>
      <path d="M2 22h20"/>
      <path d="M18 10V6a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v4"/>
      <rect x="10" y="14" width="4" height="4"/>
    </svg>
  )
}

export function IcoGem({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <path d="M6 3h12l4 6-10 13L2 9Z"/>
      <path d="M11 3 8 9l4 13 4-13-3-6"/>
      <path d="M2 9h20"/>
    </svg>
  )
}

export function IcoBan({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    </svg>
  )
}

export function IcoAlertTriangle({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

export function IcoCheckCircle({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  )
}

export function IcoXCircle({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  )
}

export function IcoUser({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

export function IcoUsers({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

export function IcoBot({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <rect x="3" y="11" width="18" height="10" rx="2"/>
      <path d="M12 11V3"/>
      <circle cx="12" cy="3" r="1"/>
      <line x1="8" y1="15" x2="8.01" y2="15"/>
      <line x1="16" y1="15" x2="16.01" y2="15"/>
      <line x1="9" y1="19" x2="15" y2="19"/>
    </svg>
  )
}

export function IcoMessageCircle({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  )
}

export function IcoFileText({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
}

export function IcoBarChart({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )
}

export function IcoSmartphone({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <rect x="5" y="2" width="14" height="20" rx="2"/>
      <line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
  )
}

export function IcoRefreshCw({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  )
}

export function IcoMapPin({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

export function IcoGlobe({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )
}

export function IcoKey({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <circle cx="7.5" cy="15.5" r="5.5"/>
      <path d="M21 2l-9.6 9.6"/>
      <path d="M15.5 7.5l3 3L22 7l-3-3"/>
    </svg>
  )
}

export function IcoPlusCircle({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  )
}

export function IcoClipboard({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    </svg>
  )
}

export function IcoClock({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}

export function IcoLink({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  )
}

export function IcoInfo({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  )
}

export function IcoStar({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

export function IcoSettings({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

export function IcoLock({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

export function IcoPause({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <rect x="6" y="4" width="4" height="16"/>
      <rect x="14" y="4" width="4" height="16"/>
    </svg>
  )
}

export function IcoPlay({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  )
}

export function IcoWifi({ size = 16, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} style={style} className={className}>
      <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
      <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
      <path d="M8.53 16.11a6 16 0 0 1 6.95 0"/>
      <line x1="12" y1="20" x2="12.01" y2="20"/>
    </svg>
  )
}

// Dot colorido — substitui 🟢⚫🔴🟡 em badges de status
export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
}
