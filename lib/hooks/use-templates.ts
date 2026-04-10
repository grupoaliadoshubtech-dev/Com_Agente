'use client'
// ─────────────────────────────────────────────────────────────
// lib/hooks/use-templates.ts
// FASE 5 — Hook para gerenciar respostas rápidas no Workspace.
// Detecta "/" no input e exibe menu de templates filtrado.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react'

export interface Template {
  id:        string
  atalho:    string
  titulo:    string
  mensagem:  string
  categoria: string
}

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading]     = useState(true)
  const [showMenu, setShowMenu]   = useState(false)
  const [filter, setFilter]       = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)

  // Carrega templates ao montar
  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    try {
      const res = await fetch('/api/templates', { cache: 'no-store' })
      const data = await res.json()
      if (data.success && data.data) {
        setTemplates(data.data)
      }
    } catch {
      console.error('Erro ao carregar templates')
    } finally {
      setLoading(false)
    }
  }

  // Templates filtrados pelo que o usuário digitou após "/"
  const filtered = useMemo(() => {
    if (!filter) return templates
    const q = filter.toLowerCase()
    return templates.filter(t =>
      t.atalho.toLowerCase().includes(q) ||
      t.titulo.toLowerCase().includes(q) ||
      t.categoria.toLowerCase().includes(q)
    )
  }, [templates, filter])

  // Categorias únicas
  const categories = useMemo(() => {
    return Array.from(new Set(templates.map(t => t.categoria))).sort()
  }, [templates])

  // Detecta "/" no input e abre/fecha o menu
  const handleInputChange = useCallback((value: string) => {
    const slashIdx = value.lastIndexOf('/')
    if (slashIdx !== -1) {
      // Verifica se o "/" é o início de um atalho (após espaço ou início)
      const before = value[slashIdx - 1]
      if (slashIdx === 0 || before === ' ' || before === '\n') {
        const afterSlash = value.slice(slashIdx + 1)
        // Se não tem espaço após o atalho, é um filtro ativo
        if (!afterSlash.includes(' ')) {
          setFilter(afterSlash)
          setShowMenu(true)
          setSelectedIdx(0)
          return
        }
      }
    }
    setShowMenu(false)
    setFilter('')
  }, [])

  // Navegar no menu com setas e Enter
  const handleKeyDown = useCallback((e: React.KeyboardEvent, onSelect: (text: string, originalInput: string) => void, currentInput: string) => {
    if (!showMenu || filtered.length === 0) return false

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => (i + 1) % filtered.length)
      return true
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => (i - 1 + filtered.length) % filtered.length)
      return true
    }
    if (e.key === 'Tab' || (e.key === 'Enter' && showMenu)) {
      e.preventDefault()
      const template = filtered[selectedIdx]
      if (template) {
        // Remove o "/" e o filtro do input, substitui pela mensagem do template
        const slashIdx = currentInput.lastIndexOf('/')
        const beforeSlash = currentInput.slice(0, slashIdx)
        onSelect(beforeSlash + template.mensagem, currentInput)
        setShowMenu(false)
        setFilter('')
      }
      return true
    }
    if (e.key === 'Escape') {
      setShowMenu(false)
      setFilter('')
      return true
    }
    return false
  }, [showMenu, filtered, selectedIdx])

  // Selecionar template por clique
  const selectTemplate = useCallback((template: Template, currentInput: string): string => {
    const slashIdx = currentInput.lastIndexOf('/')
    const beforeSlash = currentInput.slice(0, Math.max(0, slashIdx))
    setShowMenu(false)
    setFilter('')
    return beforeSlash + template.mensagem
  }, [])

  // Fecha o menu
  const closeMenu = useCallback(() => {
    setShowMenu(false)
    setFilter('')
  }, [])

  return {
    templates,
    filtered,
    categories,
    loading,
    showMenu,
    selectedIdx,
    handleInputChange,
    handleKeyDown,
    selectTemplate,
    closeMenu,
    fetchTemplates,
  }
}
