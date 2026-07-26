import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'ComAgente — Agência de Atendimento Digital'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#111214',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          fontFamily: 'system-ui, Arial Black, sans-serif',
        }}
      >
        {/* Grid background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(163,230,53,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(163,230,53,.04) 1px,transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Logo CA */}
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: 28,
            background: '#A3E635',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 40,
            boxShadow: '0 0 60px rgba(163,230,53,0.4)',
          }}
        >
          <span style={{ fontSize: 72, fontWeight: 900, color: '#000', letterSpacing: '-2px' }}>
            CA
          </span>
        </div>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
          <span style={{ fontSize: 88, fontWeight: 800, color: '#ffffff', letterSpacing: '-3px' }}>
            Com
          </span>
          <span style={{ fontSize: 88, fontWeight: 800, color: '#A3E635', letterSpacing: '-3px' }}>
            Agente
          </span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 32,
            color: '#888',
            marginTop: 16,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          Agência de Atendimento Digital
        </div>

        {/* Domain */}
        <div
          style={{
            marginTop: 48,
            padding: '12px 32px',
            borderRadius: 100,
            border: '1px solid rgba(163,230,53,0.3)',
            background: 'rgba(163,230,53,0.06)',
            fontSize: 24,
            color: '#A3E635',
            letterSpacing: '0.03em',
          }}
        >
          comagente.gaht.com.br
        </div>
      </div>
    ),
    { ...size }
  )
}
