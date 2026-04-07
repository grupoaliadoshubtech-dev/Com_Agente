'use client'
import { useEffect, useState, useMemo } from 'react'
import type { ClientRecord } from '@/types'

function initials(n: string) { return n.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()||'?' }
function fmtPhone(p: string) {
  const d = p.replace(/\D/g,'')
  if(d.length===13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`
  return p
}

const STATUS_CLR: Record<string,string> = {
  'ativo':'#10B981','cliente':'#10B981','lead':'#60A5FA',
  'instalado':'#A3E635','aguardando':'#F59E0B',
  'inativo':'#EF4444','cancelado':'#EF4444',
}
function sColor(s: string){ return STATUS_CLR[s.toLowerCase().trim()]||'#A0A0A0' }

const AVATAR_COLORS = ['#6366F1','#EC4899','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EF4444','#06B6D4']

export default function CRMPage() {
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState('todos')
  const [selected,setSelected]= useState<ClientRecord|null>(null)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/crm',{cache:'no-store'})
      const d = await r.json()
      if(d.success) setClients(Array.isArray(d.data)?d.data:[])
      else setError(d.error)
    } catch { setError('Erro ao carregar') }
    finally { setLoading(false) }
  }
  useEffect(()=>{load()},[])

  const statuses = useMemo(()=>['todos',...Array.from(new Set(clients.map(c=>c.status).filter(Boolean)))],[clients])
  const filtered = useMemo(()=>clients.filter(c=>{
    const ms = !search||c.nome.toLowerCase().includes(search.toLowerCase())||c.telefone.includes(search)
    const mf = filter==='todos'||c.status===filter
    return ms&&mf
  }),[clients,search,filter])

  const S = {
    wrap:{ display:'flex',height:'100%',overflow:'hidden' },
    main:{ flex:1,display:'flex',flexDirection:'column' as const,overflow:'hidden' },
    toolbar:{ padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:10,flexShrink:0,flexWrap:'wrap' as const,background:'var(--bg-card)' },
    title:{ fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:'var(--txt)',flex:1 },
    sub:{ fontSize:11,color:'var(--txt-2)',marginTop:2 },
    inp:{ padding:'8px 12px',borderRadius:8,fontSize:13,width:200 },
    sel:{ padding:'8px 12px',borderRadius:8,fontSize:13,width:150 },
    btn:{ padding:'8px 14px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',background:'var(--bg-input)',border:'1px solid var(--border)',color:'var(--txt-2)',fontFamily:"'Plus Jakarta Sans',sans-serif" },
    table:{ flex:1,overflowY:'auto' as const },
    th:{ padding:'10px 16px',fontSize:11,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'.07em',color:'var(--txt-3)',textAlign:'left' as const,background:'var(--bg-card)',position:'sticky' as const,top:0,zIndex:5,borderBottom:'1px solid var(--border)' },
    tr:{ borderBottom:'1px solid var(--border)',cursor:'pointer',transition:'background .12s' },
    td:{ padding:'12px 16px',fontSize:13,color:'var(--txt-2)',verticalAlign:'middle' as const },
    detail:{ width:280,borderLeft:'1px solid var(--border)',display:'flex',flexDirection:'column' as const,background:'var(--bg-card)',flexShrink:0 },
    dhead:{ padding:'12px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between' },
    dbody:{ padding:16,overflowY:'auto' as const,flex:1 },
  }

  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',gap:10,color:'var(--txt-2)'}}><span className="spinner" style={{width:18,height:18}}/><span style={{fontSize:13}}>Carregando clientes...</span></div>
  if(error)   return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',flexDirection:'column',gap:10}}><p style={{color:'var(--danger)',fontSize:14}}>{error}</p><button className="btn-outline" onClick={load} style={{padding:'8px 16px',fontSize:13}}>Tentar novamente</button></div>

  return (
    <div style={S.wrap}>
      <div style={S.main}>
        {/* Toolbar */}
        <div style={S.toolbar}>
          <div><div style={S.title}>CRM / Clientes</div><div style={S.sub}>{clients.length} registros · somente leitura</div></div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nome ou número..." style={S.inp}/>
          <select value={filter} onChange={e=>setFilter(e.target.value)} style={S.sel}>
            {statuses.map(s=><option key={s} value={s}>{s==='todos'?'Todos os status':s}</option>)}
          </select>
          <button style={S.btn} onClick={load}>↻</button>
        </div>

        {/* Table */}
        <div style={S.table}>
          {filtered.length===0 ? (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:200,gap:8,color:'var(--txt-3)'}}>
              <span style={{fontSize:32}}>👥</span><p style={{fontSize:13}}>Nenhum cliente encontrado</p>
            </div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr>
                  {['Cliente','Telefone','Status','Histórico'].map(h=><th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c,i)=>{
                  const active = selected?.telefone===c.telefone
                  const clr    = AVATAR_COLORS[i%AVATAR_COLORS.length]
                  return (
                    <tr key={i} style={{...S.tr,background:active?'var(--neon-dim)':'transparent'}}
                      onMouseEnter={e=>{if(!active)(e.currentTarget as HTMLTableRowElement).style.background='var(--bg-hover)'}}
                      onMouseLeave={e=>{if(!active)(e.currentTarget as HTMLTableRowElement).style.background='transparent'}}
                      onClick={()=>setSelected(c)}>
                      <td style={S.td}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{width:34,height:34,borderRadius:'50%',background:clr,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#fff',flexShrink:0}}>{initials(c.nome)}</div>
                          <span style={{fontWeight:500,color:'var(--txt)'}}>{c.nome||'—'}</span>
                        </div>
                      </td>
                      <td style={{...S.td,fontFamily:'monospace',fontSize:12}}>{fmtPhone(c.telefone)}</td>
                      <td style={S.td}>
                        {c.status ? (
                          <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:100,background:`${sColor(c.status)}18`,border:`1px solid ${sColor(c.status)}40`,color:sColor(c.status)}}>
                            <span style={{width:5,height:5,borderRadius:'50%',background:sColor(c.status)}}/>
                            {c.status}
                          </span>
                        ) : <span style={{color:'var(--txt-3)'}}>—</span>}
                      </td>
                      <td style={{...S.td,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.historico||'—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={S.detail}>
          <div style={S.dhead}>
            <span style={{fontSize:13,fontWeight:600,color:'var(--txt)'}}>Detalhes</span>
            <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',fontSize:18,cursor:'pointer',color:'var(--txt-2)',lineHeight:1}}>×</button>
          </div>
          <div style={S.dbody}>
            {/* Avatar */}
            <div style={{textAlign:'center',marginBottom:20}}>
              <div style={{width:56,height:56,borderRadius:'50%',background:AVATAR_COLORS[filtered.indexOf(selected)%AVATAR_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:700,color:'#fff',margin:'0 auto 10px'}}>{initials(selected.nome)}</div>
              <p style={{fontSize:15,fontWeight:600,color:'var(--txt)'}}>{selected.nome||'—'}</p>
              {selected.status && <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:10,fontWeight:600,padding:'3px 10px',borderRadius:100,background:`${sColor(selected.status)}18`,border:`1px solid ${sColor(selected.status)}40`,color:sColor(selected.status),marginTop:6}}><span style={{width:4,height:4,borderRadius:'50%',background:sColor(selected.status)}}/>{selected.status}</span>}
            </div>
            {[['Telefone',fmtPhone(selected.telefone)],['Histórico',selected.historico||'—']].map(([l,v])=>(
              <div key={l} style={{marginBottom:14}}>
                <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--txt-3)',marginBottom:4}}>{l}</p>
                <p style={{fontSize:13,color:'var(--txt-2)',wordBreak:'break-word'}}>{v}</p>
              </div>
            ))}
            <div style={{borderTop:'1px solid var(--border)',paddingTop:14,marginTop:4}}>
              <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--txt-3)',marginBottom:8}}>Ações rápidas</p>
              <a href={`/transcricoes?telefone=${selected.telefone}`} style={{fontSize:12,color:'var(--neon)',textDecoration:'none',display:'flex',alignItems:'center',gap:6}}>
                📝 Ver transcrições deste cliente
              </a>
            </div>
            <p style={{textAlign:'center',fontSize:10,color:'var(--txt-3)',marginTop:20}}>🔒 Somente leitura</p>
          </div>
        </div>
      )}
    </div>
  )
}
