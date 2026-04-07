'use client'
// lib/context/theme-context.tsx
// Contexto global de tema — dark/light.
// Persiste no localStorage e aplica data-theme no <html>.

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme:       Theme
  toggleTheme: () => void
  isDark:      boolean
}

const ThemeContext = createContext<ThemeContextValue>({
  theme:       'dark',
  toggleTheme: () => {},
  isDark:      true,
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  // Inicializa a partir do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('aad-theme') as Theme | null
    const initial = saved ?? 'dark'
    setTheme(initial)
    document.documentElement.setAttribute('data-theme', initial)
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('aad-theme', next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
