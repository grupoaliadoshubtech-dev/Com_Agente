// app/layout.tsx
// FASE 3: Adicionado meta tags PWA, viewport mobile, apple-touch-icon
import type { Metadata, Viewport } from 'next'
import { DM_Sans, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { SessionProvider } from '@/components/session-provider'
import { PWARegister } from '@/components/pwa-register'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

const BASE_URL = 'https://comagente.gaht.com.br'

export const metadata: Metadata = {
  title: 'ComAgente',
  description: 'Agência de Atendimento Digital',
  metadataBase: new URL(BASE_URL),
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ComAgente',
  },
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png',   sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/icon-192.png',
  },
  openGraph: {
    title: 'ComAgente — Agência de Atendimento Digital',
    description: 'Plataforma de atendimento digital via WhatsApp com inteligência artificial.',
    url: BASE_URL,
    siteName: 'ComAgente',
    images: [
      {
        url: `${BASE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: 'ComAgente — Agência de Atendimento Digital',
      },
    ],
    locale: 'pt_BR',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#111214',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${dmSans.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans antialiased min-h-screen">
        <SessionProvider>{children}</SessionProvider>
        <PWARegister />
      </body>
    </html>
  )
}
