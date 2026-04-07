'use client'
import { useEffect, useState } from 'react'
import type { LogErroRecord } from '@/lib/repositories/admin.repository'

interface Stats { total:number; hoje:number; porTenant:Record<string,number>; porNo:Record<string,number> }
function fmtDT(iso:string){if(!iso)return'—';try{return new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})}catch{return iso}}
function level(msg:string):'critical'|'warning'|'info'{const l=msg.toLowerCase();if(l.includes('fatal')||l.includes('timeout')||l.includes('crash'))return'critical';if(l.includes('erro')||l.includes('error')||l.includes('falha'))return'warning';return'info'}
const LV_CLR={critical:'#EF4444',warning:'#F59E0B',info:'#60A5FA'}
const LV_BG ={critical:'rgba(239,68,68,.1)',warning:'rgba(245,158,11,.1)',info:'rgba(96,165,250,.1)'}
const LV_ICN={critical:'🔴',warning:'🟡',info:'ℹ️'}

export default function LogsPage(){
  const [records,setRecords]=useState<LogErroRecord[]>([])
  const [stats,  setStats]  =useState<Stats|null>(null)
  const [loading,setLoading]=useState(true)
  const [search, setSearch] =useState('')
  const [tenant, setTenant] =useState('todos')
  const [sel,    setSel]    =useState<LogErroRecord|null>(null)
  const [auto,   setAuto]   =useState(false)

  async function load(){
    setLoading(true)
    const url=`/api/admin/logs${tenant!=='todos'?`?tenantId=${tenant}`:''}`
    const r=await fetch(url,{cache:'no-store'});const d=await r.json()
    if(d.success){setRecords(d.data.records);setStats(d.data.stats)}
    setLoading(false)
  }
  useEffect(()=>{load()},[tenant])
  useEffect(()=>{if(!auto)return;const id=setInterval(load,30000);return()=>clearInterval(id)},[auto,tenant])

  const tenants=['todos',...Object.keys(stats?.porTenant??{})]
  const filtered=records.filter(r=>!search||r.erro.toLowerCase().includes(search.toLowerCase())||r.no.toLowerCase().includes(search.toLowerCase())||r.telefone.includes(search)||r.tenant.toLowerCase().includes(search.toLowerCase()))

  const th={padding:'10px 16px',fontSize:11,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'.07em',color:'var(--txt-3)',textAlign:'left' as const,background:'var(--bg-card)',position:'sticky' as const,top:0,zIndex:5,borderBottom:'1px solid var(--border)'}
  const td={padding:'10px 16px',fontSize:13,color:'var(--txt-2)',verticalAlign:'middle' as const}

  return (
    <div style={{display:'flex',height:'100%',overflow:'hidden'}}>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {/* Toolbar */}
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:10,flexShrink:0,background:'var(--bg-card)',flexWrap:'wrap'}}>
          <div style={{flex:1}}>
            <div className="font-display" style={{fontSize:16,fontWeight:700,color:'var(--txt)'}}>Log de Erros</div>
            <div style={{fontSize:11,color:'var(--txt-2)',marginTop:2}}>{stats?.total??0} total · {stats?.hoje??0} hoje · todos os tenants</div>
          </div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar erro, nó, telefone..." style={{padding:'8px 12px',borderRadius:8,fontSize:13,width:240}}/>
          <select value={tenant} onChange={e=>setTenant(e.target.value)} style={{padding:'8px 12px',borderRadius:8,fontSize:13,width:180}}>
            {tenants.map(t=><option key={t} value={t}>{t==='todos'?'Todos os tenants':t}</option>)}
          </select>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--txt-2)',cursor:'pointer'}}>
            <div onClick={()=>setAuto(a=>!a)} className={`ia-toggle ${auto?'ia-toggle-on':'ia-toggle-off'}`}/>
            Auto 30s
          </label>
          <button onClick={load} style={{padding:'8px 12px',borderRadius:8,fontSize:12,cursor:'pointer',background:'var(--bg-input)',border:'1px solid var(--border)',color:'var(--txt-2)',fontFamily:"'Plus Jakarta Sans',sans-serif"}}>↻</button>
        </div>

        {/* Stats row */}
        {stats&&(
          <div style={{padding:'10px 20px',borderBottom:'1px solid var(--border)',display:'flex',gap:24,flexShrink:0,flexWrap:'wrap',background:'var(--bg-card)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}><span className="font-display" style={{fontSize:20,fontWeight:700,color:'#EF4444'}}>{stats.hoje}</span><span style={{fontSize:12,color:'var(--txt-3)'}}>hoje</span></div>
            <div style={{display:'flex',alignItems:'center',gap:8}}><span className="font-display" style={{fontSize:20,fontWeight:700,color:'var(--txt)'}}>{stats.total}</span><span style={{fontSize:12,color:'var(--txt-3)'}}>total</span></div>
            {Object.entries(stats.porNo).sort(([,a],[,b])=>b-a).slice(0,3).map(([n,c])=>(
              <div key={n} style={{display:'flex',alignItems:'center',gap:5}}>
                <span style={{fontSize:11,fontFamily:'monospace',color:'#F59E0B'}}>{n}</span>
                <span style={{fontSize:11,color:'var(--txt-3)'}}>({c})</span>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div style={{flex:1,overflowY:'auto'}}>
          {loading?(
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:200,gap:10,color:'var(--txt-2)'}}><span className="spinner" style={{width:18,height:18}}/><span style={{fontSize:13}}>Carregando logs...</span></div>
          ):filtered.length===0?(
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:200,gap:8,color:'var(--txt-3)'}}><span style={{fontSize:32}}>✅</span><p style={{fontSize:13}}>Nenhum erro encontrado</p></div>
          ):(
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Timestamp','Nível','Tenant','Nó','Erro','Telefone'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((r,i)=>{
                  const lv=level(r.erro),active=sel===r
                  return (
                    <tr key={i} style={{borderBottom:'1px solid var(--border)',cursor:'pointer',background:active?'var(--bg-hover)':'transparent',transition:'background .12s'}}
                      onMouseEnter={e=>{if(!active)(e.currentTarget as HTMLTableRowElement).style.background='var(--bg-hover)'}}
                      onMouseLeave={e=>{if(!active)(e.currentTarget as HTMLTableRowElement).style.background='transparent'}}
                      onClick={()=>setSel(sel===r?null:r)}>
                      <td style={{...td,fontFamily:'monospace',fontSize:11,whiteSpace:'nowrap'}}>{fmtDT(r.timestamp)}</td>
                      <td style={td}>
                        <span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:100,background:LV_BG[lv],color:LV_CLR[lv]}}>
                          {LV_ICN[lv]} {lv}
                        </span>
                      </td>
                      <td style={{...td,fontSize:12}}>{r.tenant}</td>
                      <td style={{...td,fontFamily:'monospace',fontSize:11,color:'#F59E0B'}}>{r.no||'—'}</td>
                      <td style={{...td,maxWidth:260}}><p style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.erro}</p></td>
                      <td style={{...td,fontFamily:'monospace',fontSize:11}}>{r.telefone||'—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail */}
      {sel&&(
        <div style={{width:300,borderLeft:'1px solid var(--border)',display:'flex',flexDirection:'column',background:'var(--bg-card)',flexShrink:0}}>
          <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:13,fontWeight:600,color:'var(--txt)'}}>Detalhes</span>
            <button onClick={()=>setSel(null)} style={{background:'none',border:'none',fontSize:18,cursor:'pointer',color:'var(--txt-2)',lineHeight:1}}>×</button>
          </div>
          <div style={{padding:16,overflowY:'auto',flex:1}}>
            {[['Timestamp',fmtDT(sel.timestamp)],['Tenant',sel.tenant],['Nó / Rota',sel.no||'—'],['Telefone',sel.telefone||'—']].map(([l,v])=>(
              <div key={l} style={{marginBottom:12}}>
                <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--txt-3)',marginBottom:3}}>{l}</p>
                <p style={{fontSize:12,color:'var(--txt-2)',fontFamily:'monospace',wordBreak:'break-all'}}>{v}</p>
              </div>
            ))}
            <div style={{marginBottom:12}}>
              <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--txt-3)',marginBottom:6}}>Mensagem de erro</p>
              <div style={{borderRadius:8,padding:12,fontSize:12,fontFamily:'monospace',color:'#FCA5A5',wordBreak:'break-all',lineHeight:1.6,background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.2)'}}>{sel.erro}</div>
            </div>
            <div>
              <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--txt-3)',marginBottom:6}}>Nível</p>
              <span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600,padding:'3px 9px',borderRadius:100,background:LV_BG[level(sel.erro)],color:LV_CLR[level(sel.erro)]}}>
                {LV_ICN[level(sel.erro)]} {level(sel.erro)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
