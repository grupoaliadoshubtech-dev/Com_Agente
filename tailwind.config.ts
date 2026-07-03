import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Design System — usa variáveis CSS para suporte a temas
        base:      'var(--bg)',
        card:      'var(--bg-card)',
        input:     'var(--bg-input)',
        neon:      'var(--neon)',
        muted:     'var(--txt-3)',
        secondary: 'var(--txt-2)',
      },
      backgroundColor: {
        base:  'var(--bg)',
        card:  'var(--bg-card)',
        input: 'var(--bg-input)',
      },
      borderColor: {
        DEFAULT: 'var(--border)',
        neon:    'rgba(163,230,53,0.3)',
        danger:  'rgba(239,68,68,0.4)',
      },
      textColor: {
        muted:     'var(--txt-3)',
        secondary: 'var(--txt-2)',
        neon:      'var(--neon)',
      },
      fontFamily: {
        sans:    ['DM Sans', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
