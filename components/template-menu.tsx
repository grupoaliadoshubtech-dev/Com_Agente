'use client'
// ─────────────────────────────────────────────────────────────
// components/template-menu.tsx
// FASE 5 — Menu popup de respostas rápidas.
// Aparece quando o atendente digita "/" no campo de mensagem.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react'

interface Template {
  id:        string
  atalho:    string
  titulo:    string
  mensagem:  string
  categoria: string
}

interface TemplateMenuProps {
  templates:   Template[]
  selectedIdx: number
  onSelect:    (template: Template) => void
  onClose:     () => void
}

export function TemplateMenu({ templates, selectedIdx, onSelect, onClose }: TemplateMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLDivElement>(null)

  // Scroll para o item selecionado
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  if (templates.length === 0) {
    return (
      <div ref={menuRef} style={{
        position: 'absolute', bottom: '100%', left: 0, right: 0,
        marginBottom: 8, borderRadius: 12, overflow: 'hidden',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.4)', padding: '12px 16px',
        zIndex: 100,
      }}>
        <p style={{ fontSize: 12, color: 'var(--txt-3)', textAlign: 'center' }}>
          Nenhum template encontrado
        </p>
      </div>
    )
  }

  // Agrupa por categoria
  const byCategory = new Map<string, Template[]>()
  for (const t of templates) {
    const cat = t.categoria || 'geral'
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(t)
  }

  let globalIdx = 0

  return (
    <div ref={menuRef} style={{
      position: 'absolute', bottom: '100%', left: 0, right: 0,
      marginBottom: 8, borderRadius: 12, overflow: 'hidden',
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
      maxHeight: 320, overflowY: 'auto', zIndex: 100,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt-2)' }}>
          Respostas Rápidas
        </span>
        <span style={{ fontSize: 10, color: 'var(--txt-3)' }}>
          ↑↓ navegar · Enter selecionar · Esc fechar
        </span>
      </div>

      {/* Templates agrupados */}
      {Array.from(byCategory.entries()).map(([cat, items]) => (
        <div key={cat}>
          {byCategory.size > 1 && (
            <div style={{
              padding: '6px 14px', fontSize: 10, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '.06em',
              color: 'var(--txt-3)', background: 'rgba(255,255,255,0.02)',
            }}>
              {cat}
            </div>
          )}
          {items.map(template => {
            const idx = globalIdx++
            const isSelected = idx === selectedIdx
            return (
              <div
                key={template.id}
                ref={isSelected ? selectedRef : undefined}
                onClick={() => onSelect(template)}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  background: isSelected ? 'var(--neon-dim)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--neon)' : '3px solid transparent',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                {/* Atalho */}
                <code style={{
                  flexShrink: 0, fontSize: 12, fontWeight: 600,
                  padding: '2px 8px', borderRadius: 5,
                  background: isSelected ? 'rgba(163,230,53,0.15)' : 'rgba(255,255,255,0.06)',
                  color: isSelected ? 'var(--neon)' : 'var(--txt-2)',
                  border: `1px solid ${isSelected ? 'var(--neon-border)' : 'rgba(255,255,255,0.08)'}`,
                }}>
                  {template.atalho}
                </code>

                {/* Conteúdo */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)', marginBottom: 2 }}>
                    {template.titulo}
                  </p>
                  <p style={{
                    fontSize: 11, color: 'var(--txt-3)', lineHeight: 1.4,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {template.mensagem}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
