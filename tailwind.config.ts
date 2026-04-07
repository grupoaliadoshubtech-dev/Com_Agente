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
        // Design System AAD
        base:   '#121212',
        card:   '#1E1E1E',
        input:  '#2A2A2A',
        neon:   '#A3E635',
      },
      backgroundColor: {
        base:  '#121212',
        card:  '#1E1E1E',
        input: '#2A2A2A',
      },
      borderColor: {
        DEFAULT: 'rgba(255,255,255,0.08)',
        neon:    'rgba(163,230,53,0.3)',
        danger:  'rgba(239,68,68,0.4)',
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
