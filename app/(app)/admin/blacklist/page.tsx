'use client'
import { useEffect, useState } from 'react'
import type { GlobalBlacklistRecord } from '@/lib/repositories/admin.repository'

function fmtDT(iso:string){if(!iso)return'—';try{return new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return iso}}

export default function BlacklistPage(){
  const [records,setRecords]=useState<GlobalBlacklistRecord[]>([])
  const [loading,setLoading]=useState(true)
  const [search, setSearch] =useState('')
  const [scope,  setScope]  =useState<'todos'|'global'|'local'>('todos')
  const [modal,  setModal]  =useState(false)
  const [phone,  setPhone]  =useState('')
  const [motivo, setMotivo] =useState('')
  const [adding, setAdding] =useState(false)
  const [toast,  setToast]  =useState('')

  function showToast(m:string){setToast(m);setTimeout(()=>setToast(''),3500)}
  async function load(){setLoading(true);const r=await fetch('/api/admin/blacklist');const d=await r.json();if(d.success)setRecords(d.data);setLoading(false)}
  useEffect(()=>{load()},[])

  async function add(e:React.FormEvent){
    e.preventDefault();setAdding(true)
    const r=await fetch('/api/admin/blacklist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({telefone:phone.trim(),motivo:motivo.trim()||'Bloqueado pelo Master Admin'})})
    const d=await r.json();setAdding(false)
    if(d.success){setModal(false);setPhone('');setMotivo('');load();showToast('✓ Número bloqueado globalmente')}
    else showToast(`Erro: ${d.error}`)
  }

  const filtered=records.filter(r=>{
    const ms=!search||r.telefone.includes(search)||r.tenant.toLowerCase().includes(search.toLowerCase())
    const mc=scope==='todos'||r.scope===scope
    return ms&&mc
  })

  const th={padding:'10px 16px',fontSize:11,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'.07em',color:'var(--txt-3)',textAlign:'left' as const,background:'var(--bg-card)',position:'sticky' as const,top:0,zIndex:5,borderBottom:'1px solid var(--border)'}
  const td={padding:'11px 16px',fontSize:13,color:'var(--txt-2)',verticalAlign:'middle' as const}

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      {/* Toolbar */}
      <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:10,flexShrink:0,background:'var(--bg-card)',flexWrap:'wrap'}}>
        <div style={{flex:1}}>
          <div className="font-display" style={{fontSize:16,fontWeight:700,color:'var(--txt)'}}>Blacklist Global</div>
          <div style={{fontSize:11,color:'var(--txt-2)',marginTop:2}}>{records.length} números · {records.filter(r=>r.scope==='global').length} globais · {records.filter(r=>r.scope==='local').length} locais</div>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar número ou tenant..." style={{padding:'8px 12px',borderRadius:8,fontSize:13,width:220}}/>
        <div style={{display:'flex',borderRadius:8,overflow:'hidden',border:'1px solid var(--border)'}}>
          {(['todos','global','local'] as const).map(s=>(
            <button key={s} onClick={()=>setScope(s)} style={{padding:'7px 14px',fontSize:12,fontWeight:600,cursor:'pointer',background:scope===s?'var(--neon-dim)':'transparent',color:scope===s?'var(--neon)':'var(--txt-2)',border:'none',fontFamily:"'Plus Jakarta Sans',sans-serif",textTransform:'capitalize'}}>
              {s}
            </button>
          ))}
        </div>
        <button onClick={()=>setModal(true)} style={{padding:'9px 16px',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',background:'var(--danger)',color:'#fff',border:'none',fontFamily:"'Plus Jakarta Sans',sans-serif",display:'flex',alignItems:'center',gap:6}}>
          🚫 Bloquear
        </button>
        <button onClick={load} style={{padding:'8px 12px',borderRadius:8,fontSize:12,cursor:'pointer',background:'var(--bg-input)',border:'1px solid var(--border)',color:'var(--txt-2)',fontFamily:"'Plus Jakarta Sans',sans-serif"}}>↻</button>
      </div>

      {/* Banner */}
      <div style={{padding:'10px 20px',borderBottom:'1px solid var(--border)',background:'rgba(239,68,68,.06)',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
        <span style={{color:'#EF4444',fontSize:14}}>🔴</span>
        <span style={{fontSize:12,color:'rgba(252,165,165,.8)'}}>Números na Blacklist Global são bloqueados em <strong>todos os tenants</strong> simultaneamente.</span>
      </div>

      {/* Table */}
      <div style={{flex:1,overflowY:'auto'}}>
        {loading?(
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:200,gap:10,color:'var(--txt-2)'}}><span className="spinner" style={{width:18,height:18}}/><span style={{fontSize:13}}>Carregando...</span></div>
        ):filtered.length===0?(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:200,gap:8,color:'var(--txt-3)'}}><span style={{fontSize:32}}>✅</span><p style={{fontSize:13}}>Nenhum número bloqueado</p></div>
        ):(
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>{['Telefone','Escopo','Tenant','Motivo','Bloqueado em'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((r,i)=>(
                <tr key={i} style={{borderBottom:'1px solid var(--border)',transition:'background .12s'}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLTableRowElement).style.background='var(--bg-hover)'}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLTableRowElement).style.background='transparent'}}>
                  <td style={{...td,fontFamily:'monospace',fontSize:12,color:'var(--txt)'}}>{r.telefone}</td>
                  <td style={td}>
                    <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,fontWeight:600,padding:'3px 9px',borderRadius:100,background:r.scope==='global'?'rgba(239,68,68,.12)':'rgba(255,255,255,.06)',border:`1px solid ${r.scope==='global'?'rgba(239,68,68,.3)':'var(--border)'}`,color:r.scope==='global'?'#FCA5A5':'var(--txt-2)'}}>
                      {r.scope==='global'?'🌐 Global':'📍 Local'}
                    </span>
                  </td>
                  <td style={td}>{r.tenant}</td>
                  <td style={{...td,maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.motivo||'—'}</td>
                  <td style={{...td,fontSize:12}}>{fmtDT(r.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',backdropFilter:'blur(4px)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          <div className="card animate-slide-up" style={{maxWidth:380,width:'100%',padding:24}}>
            <h3 className="font-display" style={{fontSize:15,fontWeight:700,color:'var(--txt)',marginBottom:6}}>🚫 Bloquear número globalmente</h3>
            <p style={{fontSize:13,color:'var(--txt-2)',marginBottom:20,lineHeight:1.5}}>O número será ignorado em todos os tenants.</p>
            <form onSubmit={add} style={{display:'flex',flexDirection:'column',gap:12}}>
              <div>
                <label style={{display:'block',fontSize:12,fontWeight:600,color:'var(--txt-2)',marginBottom:5}}>Número (com DDI)</label>
                <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="5571999999999" required style={{width:'100%',padding:'9px 12px'}}/>
              </div>
              <div>
                <label style={{display:'block',fontSize:12,fontWeight:600,color:'var(--txt-2)',marginBottom:5}}>Motivo</label>
                <input value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Spam, fraude, etc." style={{width:'100%',padding:'9px 12px'}}/>
              </div>
              <div style={{display:'flex',gap:10,marginTop:4}}>
                <button type="button" onClick={()=>setModal(false)} className="btn-outline" style={{flex:1,padding:'10px',fontSize:13}}>Cancelar</button>
                <button type="submit" disabled={adding} className="btn-danger" style={{flex:1,padding:'10px',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                  {adding?<><span className="spinner" style={{width:14,height:14}}/>Bloqueando...</>:'Confirmar bloqueio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast&&<div className="toast-base">{toast}</div>}
    </div>
  )
}
