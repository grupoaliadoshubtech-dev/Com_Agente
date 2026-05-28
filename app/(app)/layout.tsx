'use client'
// app/(app)/layout.tsx — CONSOLIDADO (Fases 5+6: Templates + Distribuição na nav)

import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'
import { useHandoff } from '@/lib/hooks/use-handoff'
import { ThemeProvider, useTheme } from '@/lib/context/theme-context'

// SVG icons
const IC = {
  workspace:   <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  dashboard:   <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  crm:         <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  transcricoes:<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  satisfacao:  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>,
  conexao:     <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
  equipe:      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  planos:      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  empresas:    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
  blacklist:   <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
  logs:        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  logout:      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  chevron:     <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="15,18 9,12 15,6"/></svg>,
  bell:        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  sun:         <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  moon:        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  menu:        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  stop:        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
  master:      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>,
  // FASE 5: Templates
  templates:   <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
  // FASE 6: Distribuição
  distribuicao:<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="12" y1="14" x2="6" y2="20"/><line x1="12" y1="14" x2="18" y2="20"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="20" r="2"/></svg>,
}

const MAIN_NAV    = [
  { label:'Workspace',     href:'/workspace',    icon:'workspace',    badge:'5', toggle:'' },
  { label:'Dashboard',     href:'/dashboard',    icon:'dashboard',    badge:'',  toggle:'canViewDashboard' },
  { label:'CRM / Clientes',href:'/crm',          icon:'crm',          badge:'',  toggle:'canViewCRM' },
  { label:'Transcrições',  href:'/transcricoes', icon:'transcricoes', badge:'',  toggle:'canViewTranscricoes' },
  { label:'Satisfação',    href:'/satisfacao',   icon:'satisfacao',   badge:'',  toggle:'canViewSatisfacao' },
]
const CONFIG_NAV  = [
  { label:'Conexão WhatsApp',  href:'/supervisor/conexao',      icon:'conexao',      badge:'', toggle:'' },
  { label:'Equipe',            href:'/supervisor/equipe',       icon:'equipe',       badge:'', toggle:'' },
  { label:'Planos',            href:'/supervisor/planos',       icon:'planos',       badge:'', toggle:'' },
  { label:'Respostas Rápidas', href:'/supervisor/templates',    icon:'templates',    badge:'', toggle:'' },
  { label:'Distribuição',      href:'/supervisor/distribuicao', icon:'distribuicao', badge:'', toggle:'' },
]
const MASTER_NAV  = [
  { label:'Empresas',        href:'/admin/empresas',  icon:'empresas',  badge:'', toggle:'' },
  { label:'Planos Master',   href:'/admin/planos',    icon:'master',    badge:'', toggle:'' },
  { label:'Blacklist Global',href:'/admin/blacklist', icon:'blacklist', badge:'', toggle:'' },
  { label:'Log de Erros',    href:'/admin/logs',      icon:'logs',      badge:'', toggle:'' },
]

const PAGE_META: Record<string, [string, string]> = {
  '/workspace':               ['Workspace',          'Fila de atendimento em tempo real'],
  '/dashboard':               ['Dashboard',          'Visão geral da operação'],
  '/crm':                     ['CRM / Clientes',     'Base de clientes cadastrados'],
  '/transcricoes':            ['Transcrições',       'Histórico de atendimentos'],
  '/satisfacao':              ['Satisfação',         'Avaliações dos clientes'],
  '/supervisor/conexao':      ['Conexão WhatsApp',   'Status da instância Evolution'],
  '/supervisor/equipe':       ['Equipe',             'Gestão de atendentes'],
  '/supervisor/planos':       ['Planos',             'Assinatura atual'],
  '/supervisor/templates':    ['Respostas Rápidas',  'Templates de mensagem para atendentes'],
  '/supervisor/distribuicao': ['Distribuição',       'Atribuição automática de atendimentos'],
  '/admin/empresas':          ['Empresas',           'Gestão de tenants'],
  '/admin/planos':            ['Planos Master',      'CRUD de assinaturas'],
  '/admin/blacklist':         ['Blacklist Global',   'Números bloqueados'],
  '/admin/logs':              ['Log de Erros',       'Erros do sistema'],
}

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const router   = useRouter()
  const pathname = usePathname()
  const handoff  = useHandoff()
  const { isDark, toggleTheme } = useTheme()

  const [col,       setCol]       = useState(false)
  const [mobOpen,   setMobOpen]   = useState(false)
  const [killModal, setKillModal] = useState(false)
  const [toast,     setToast]     = useState('')

  const user = session?.user
  const role = user?.role ?? 'atendente'
  const initials = user?.name?.split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase() ?? 'AA'

  const pageMeta = Object.entries(PAGE_META).find(([k])=>pathname.startsWith(k))
  const [pageTitle, pageSub] = pageMeta?.[1] ?? ['Página', '']

  let toastTimer: ReturnType<typeof setTimeout>
  function showToast(msg: string) {
    setToast(msg)
    clearTimeout(toastTimer)
    toastTimer = setTimeout(()=>setToast(''), 3200)
  }

  async function doKill() {
    const r = await handoff.killSwitch()
    setKillModal(false)
    showToast(r.success ? '🛑 IA pausada — ALL gravado' : `Erro: ${r.error}`)
  }

  function nav(href: string) { router.push(href); setMobOpen(false) }

  function isVisible(toggle: string): boolean {
    if (!toggle) return true
    return !!(user as Record<string, unknown>)?.[toggle]
  }

  function SidebarContent({ collapsed, showToggle, onClose }: { collapsed: boolean; showToggle?: boolean; onClose?: () => void }) {
    function NavBtn({ label, href, icon, badge, toggle }: typeof MAIN_NAV[0]) {
      if (!isVisible(toggle)) return null
      const active = pathname.startsWith(href)
      const Icon   = (IC as Record<string, React.ReactNode>)[icon]
      return (
        <button onClick={()=>nav(href)} title={collapsed ? label : undefined} style={{
          display:'flex', alignItems:'center', gap:10, width:'100%',
          padding:'9px 10px', borderRadius:10, border:'1px solid transparent',
          cursor:'pointer', marginBottom:2, textAlign:'left',
          background: active ? 'var(--nav-active-bg)' : 'transparent',
          color:       active ? 'var(--nav-active-txt)' : '#A0A0A0',
          borderColor: active ? 'var(--nav-active-border)' : 'transparent',
          fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:13, fontWeight:500,
          position:'relative', whiteSpace:'nowrap',
        }}>
          {active && <span style={{position:'absolute',left:-8,top:'50%',transform:'translateY(-50%)',width:3,height:20,background:'var(--neon)',borderRadius:'0 3px 3px 0'}}/>}
          <span style={{width:34,height:34,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,background:active?'rgba(163,230,53,.12)':'transparent'}}>{Icon}</span>
          <span style={{opacity:collapsed?0:1,width:collapsed?0:'auto',overflow:'hidden',transition:'opacity .2s,width .2s',flex:1}}>{label}</span>
          {badge && !collapsed && <span className="badge-neon">{badge}</span>}
        </button>
      )
    }

    function SecLabel({ label }: { label: string }) {
      return <div style={{fontSize:10,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'#5A5D63',padding:'12px 10px 5px',opacity:collapsed?0:1,height:collapsed?0:'auto',overflow:'hidden',whiteSpace:'nowrap',transition:'opacity .2s,height .2s'}}>{label}</div>
    }

    return (
      <>
        {showToggle && (
          <button onClick={()=>setCol(c=>!c)} style={{position:'absolute',right:-12,top:22,width:24,height:24,borderRadius:'50%',background:'var(--bg-card)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',zIndex:10,color:'var(--txt-2)',boxShadow:'var(--shadow-sm)',transform:collapsed?'rotate(180deg)':'rotate(0deg)',transition:'transform .22s'}}>
            {IC.chevron}
          </button>
        )}

        <div style={{height:58,display:'flex',alignItems:'center',padding:'0 16px',gap:10,borderBottom:'1px solid rgba(255,255,255,.06)',flexShrink:0}}>
          <div style={{width:32,height:32,borderRadius:9,background:'var(--neon)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
            <svg width="32" height="32" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" style={{display:'block'}}>
              <defs>
                <style>{`@import url('https://fonts.googleapis.com/css2?family=Raleway:wght@900&display=swap');`}</style>
              </defs>
              <g transform="translate(33, 0)">
                <text x="0" y="346" fontFamily="Raleway, Arial Black, sans-serif" fontWeight="900" fontSize="248" fill="#000000">C</text>
                <path d="M 182,346 L 214,346 L 254,167 L 222,167 Z" fill="#FFFFFF"/>
                <path d="M 230,346 L 262,346 L 302,167 L 270,167 Z" fill="#FFFFFF"/>
                <text x="277" y="346" fontFamily="Raleway, Arial Black, sans-serif" fontWeight="900" fontSize="248" fill="#000000">A</text>
              </g>
            </svg>
          </div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:'#fff',opacity:collapsed?0:1,width:collapsed?0:'auto',overflow:'hidden',whiteSpace:'nowrap',transition:'opacity .2s,width .2s',flex:1}}>
            Com<span style={{color:'var(--neon)'}}>Agente</span>
          </div>
          {onClose && (
            <button onClick={onClose} style={{width:30,height:30,borderRadius:8,background:'rgba(255,255,255,.06)',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#A0A0A0',flexShrink:0}}>
              {IC.chevron}
            </button>
          )}
        </div>

        <div style={{flex:1,padding:'10px 8px',overflowY:'auto',overflowX:'hidden'}}>
          {role==='master' && <>
            <SecLabel label="Master Admin" />
            {MASTER_NAV.map(i=><NavBtn key={i.href} {...i}/>)}
          </>}

          <SecLabel label="Principal" />
          {MAIN_NAV.map(i=><NavBtn key={i.href} {...i}/>)}

          {(role==='supervisor'||role==='master') && <>
            <SecLabel label="Configurações" />
            {CONFIG_NAV.map(i=><NavBtn key={i.href} {...i}/>)}
          </>}

          <button onClick={()=>signOut({callbackUrl:'/login'})} title={collapsed?'Sair':undefined} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'9px 10px',borderRadius:10,border:'1px solid transparent',cursor:'pointer',marginTop:8,background:'transparent',color:'#A0A0A0',fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,fontWeight:500,whiteSpace:'nowrap'}}>
            <span style={{width:34,height:34,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>{IC.logout}</span>
            <span style={{opacity:collapsed?0:1,transition:'opacity .2s'}}>Sair</span>
          </button>
        </div>

        <div style={{padding:8,borderTop:'1px solid rgba(255,255,255,.06)',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:10,background:'rgba(255,255,255,.04)'}}>
            <div style={{width:32,height:32,borderRadius:'50%',background:'var(--neon)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#0a0a0a'}}>{initials}</div>
            <div style={{flex:1,minWidth:0,opacity:collapsed?0:1,width:collapsed?0:'auto',overflow:'hidden',transition:'opacity .2s,width .2s'}}>
              <div style={{fontSize:12,fontWeight:600,color:'#fff',whiteSpace:'nowrap'}}>{user?.name??'Usuário'}</div>
              <div style={{fontSize:10,color:'#5A5D63',textTransform:'capitalize'}}>{role}</div>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden'}}>
      {mobOpen && <div onClick={()=>setMobOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:25}}/>}

      <aside className="hide-mobile" style={{width:col?64:230,background:'var(--bg-sidebar)',borderRight:'1px solid rgba(255,255,255,.06)',display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden',position:'relative',zIndex:30,transition:'width .22s ease'}}>
        <SidebarContent collapsed={col} showToggle />
      </aside>

      <aside className="show-mobile" style={{position:'fixed',top:0,left:0,bottom:0,width:240,background:'var(--bg-sidebar)',borderRight:'1px solid rgba(255,255,255,.06)',display:'flex',flexDirection:'column',overflow:'hidden',zIndex:40,transform:mobOpen?'translateX(0)':'translateX(-100%)',transition:'transform .22s ease'}}>
        <SidebarContent collapsed={false} onClose={()=>setMobOpen(false)} />
      </aside>

      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,overflow:'hidden'}}>
        <header className="topbar-base" style={{height:58,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px',flexShrink:0,gap:12}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <button className="show-mobile btn-icon" onClick={()=>setMobOpen(o=>!o)} style={{display:'none'}}>{IC.menu}</button>
            <div>
              <div className="font-display" style={{fontSize:16,fontWeight:700,color:'var(--txt)'}}>{pageTitle}</div>
              <div style={{fontSize:11,color:'var(--txt-2)',marginTop:1}}>{pageSub}</div>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button className="btn-theme" onClick={toggleTheme}>
              {isDark ? IC.sun : IC.moon}
              <span className="hide-mobile">{isDark ? 'Tema Claro' : 'Tema Escuro'}</span>
            </button>
            {(role==='supervisor'||role==='master') && (
              <button className="btn-kill" onClick={()=>setKillModal(true)}>
                {IC.stop}
                <span className="hide-mobile">Kill Switch</span>
              </button>
            )}
            <button className="btn-icon hide-mobile">{IC.bell}</button>
          </div>
        </header>

        <main style={{flex:1,overflow:'hidden'}}>{children}</main>
      </div>

      {killModal && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setKillModal(false)}}>
          <div className="card animate-slide-up" style={{maxWidth:380,width:'100%',padding:24}}>
            <div className="font-display" style={{fontSize:16,fontWeight:700,marginBottom:8,color:'var(--txt)'}}>🛑 Kill Switch Global</div>
            <p style={{fontSize:13,color:'var(--txt-2)',lineHeight:1.6,marginBottom:20}}>
              Pausará a IA em <strong style={{color:'var(--txt)'}}>TODOS os atendimentos</strong>.
              Grava <code style={{background:'var(--bg-input)',padding:'2px 6px',borderRadius:4,fontSize:12}}>{'"ALL"'}</code> na Fila_Humana.
            </p>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn-outline" onClick={()=>setKillModal(false)} style={{padding:'8px 16px',fontSize:13}}>Cancelar</button>
              <button className="btn-danger" onClick={doKill} style={{padding:'8px 16px',fontSize:13}}>{handoff.loading?'Pausando...':'Pausar toda a IA'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast-base">{toast}</div>}

    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <ThemeProvider><AppLayoutInner>{children}</AppLayoutInner></ThemeProvider>
}
