// app/layout.tsx
import type { Metadata } from 'next'
import { DM_Sans, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { SessionProvider } from '@/components/session-provider'

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

export const metadata: Metadata = {
  title: 'Agência de Atendimento Digital',
  description: 'Handoff perfeito entre IA e Humanos no WhatsApp',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${dmSans.variable} ${spaceGrotesk.variable}`}>
      <body className="bg-base text-white font-sans antialiased min-h-screen">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
